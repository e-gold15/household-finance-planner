export interface GoalPlanPayload {
  goals: Array<{
    name: string
    targetAmount: number
    currentAmount: number
    deadline: string
    priority: string
    monthlyRecommended: number
    monthlyAllocated: number
    status: string
  }>
  freeCashFlow: number
  currency: string
}

// ── AI enabled flag — works with either Anthropic or Gemini key ───────────────

export const aiEnabled =
  !!import.meta.env.VITE_ANTHROPIC_API_KEY ||
  !!import.meta.env.VITE_GEMINI_API_KEY

// ── Provider detection ─────────────────────────────────────────────────────────

function getProvider(): 'anthropic' | 'gemini' | null {
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) return 'anthropic'
  if (import.meta.env.VITE_GEMINI_API_KEY)    return 'gemini'
  return null
}

// ── Anthropic call ─────────────────────────────────────────────────────────────

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

async function callAnthropic(
  apiKey: string,
  content: AnthropicContent[],
  maxTokens = 400,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }))
    const errMsg = (errBody as { error?: { message?: string } }).error?.message ?? JSON.stringify(errBody)
    throw new Error(`API error ${response.status}: ${errMsg}`)
  }
  const data = await response.json() as { content: Array<{ text: string }> }
  return data.content[0].text.trim()
}

// ── Gemini call ────────────────────────────────────────────────────────────────

interface GeminiTextPart   { text: string }
interface GeminiInlinePart { inline_data: { mime_type: string; data: string } }
type GeminiPart = GeminiTextPart | GeminiInlinePart

async function callGemini(apiKey: string, parts: GeminiPart[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: { message: response.statusText } }))
    const errMsg = (errBody as { error?: { message?: string } }).error?.message ?? JSON.stringify(errBody)
    throw new Error(`API error ${response.status}: ${errMsg}`)
  }
  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0].content.parts[0].text.trim()
}

// ── Goal plan explainer ────────────────────────────────────────────────────────

export async function explainGoalPlan(
  payload: GoalPlanPayload,
  lang: 'en' | 'he',
): Promise<string> {
  const provider = getProvider()
  if (!provider) throw new Error('No API key configured')

  const prompt = `You are a personal finance advisor. The user has the following savings goals and allocation plan:

${JSON.stringify(payload, null, 2)}

Please provide:
1. A brief assessment of whether this plan is realistic
2. Which goals (if any) are at risk of not being met
3. 1-2 specific actionable suggestions to improve the plan

Keep your response concise (under 200 words). Be encouraging but honest.${lang === 'he' ? ' Please respond in Hebrew.' : ''}`

  if (provider === 'anthropic') {
    return callAnthropic(import.meta.env.VITE_ANTHROPIC_API_KEY, [{ type: 'text', text: prompt }])
  }
  return callGemini(import.meta.env.VITE_GEMINI_API_KEY, [{ text: prompt }])
}

// ─── Receipt scan ─────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  name: string
  amount: number
  category: string
}

const VALID_CATEGORIES = [
  'housing', 'food', 'transport', 'education', 'leisure',
  'health', 'utilities', 'clothing', 'insurance', 'savings', 'work', 'other',
] as const

const RECEIPT_PROMPT = (lang: 'en' | 'he') => `You are a receipt parser. Look at this receipt and extract the following fields.
Return ONLY a JSON object with exactly these keys — no markdown, no explanation:
{
  "name": "<merchant or store name, max 40 chars>",
  "amount": <total amount as a number, no currency symbol>,
  "category": "<one of: housing, food, transport, education, leisure, health, utilities, clothing, insurance, savings, work, other>"
}

Rules:
- "amount" must be the final total paid (including tax), as a plain number.
- "category" must be exactly one of the listed values.
- Supermarket/restaurant → "food". Gas station → "transport". Pharmacy/clinic → "health". Clothing store → "clothing". Utility bill → "utilities". Rent/mortgage → "housing". School/course → "education". Cinema/entertainment → "leisure". Insurance → "insurance". Bank/savings → "savings". Work tools/office supplies/professional expenses → "work". Anything else → "other".
- If you cannot read the amount, use 0.
- If you cannot read the merchant name, use "Receipt".
${lang === 'he' ? '- Keep merchant names in their original language as printed on the receipt.' : '- Keep merchant names in their original language as printed on the receipt.'}`

function parseReceiptText(text: string): ReceiptScanResult {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(clean) }
  catch { throw new Error('Could not parse receipt scan response') }

  const name     = typeof parsed.name     === 'string' ? parsed.name.slice(0, 60)   : 'Receipt'
  const amount   = typeof parsed.amount   === 'number' ? Math.max(0, parsed.amount) : 0
  const catRaw   = typeof parsed.category === 'string' ? parsed.category.toLowerCase().trim() : 'other'
  const category = (VALID_CATEGORIES as readonly string[]).includes(catRaw) ? catRaw : 'other'
  return { name, amount, category }
}

// ─── Payslip scan ────────────────────────────────────────────────────────────

export interface PayslipScanResult {
  gross:                      number | null
  net:                        number | null
  base:                       number | null
  overtime125:                number | null
  overtime150:                number | null
  otherTaxable:               number | null
  imputedIncome:              number | null
  nonTaxableReimbursements:   number | null
  taxCreditPoints:            number | null
  pensionEmployee:            number | null
  pensionEmployer:            number | null
  educationFundEmployee:      number | null
  educationFundEmployer:      number | null
  severanceEmployer:          number | null
  pensionBase:                number | null
  studyFundBase:              number | null
}

const PAYSLIP_PROMPT = `You are an Israeli payslip (תלוש שכר) parser. Extract salary fields from this document.
Return ONLY a JSON object with exactly these keys — no markdown, no explanation:
{
  "gross": <total taxable gross income used for income-tax calculation — look for the field labelled "ברוטו לחישוב מס הכנסה" or "הכנסה חייבת במס"; if absent, sum all taxable items — number or null>,
  "net": <final take-home pay / נטו לתשלום — the amount transferred to the employee's bank account — number or null>,
  "base": <base salary / שכר יסוד — number or null>,
  "overtime125": <overtime 125% / גלובאלי 125% or שע"נ 125% — number or null>,
  "overtime150": <overtime 150% / גלובאלי 150% or שע"נ 150% — number or null>,
  "otherTaxable": <SUM of all other taxable additions not captured above: travel allowance (נסיעות), periodic payments (גלום, תקופתי), bonuses, commissions, taxable meal allowance — number or null>,
  "imputedIncome": <SUM of all imputed income / benefit-in-kind items. Look for ANY "שווי" line OR the "זיקופי שכר" section (e.g. שווי רכב, שווי ביס, שווי יש, שווי מתנה מגולם, שווי אופציות). Add all such amounts together — number or null>,
  "nonTaxableReimbursements": <non-taxable reimbursements that are added to net AFTER tax, e.g. approved travel reimbursement above taxable cap — number or null>,
  "taxCreditPoints": <tax credit points / נקודות זיכוי — number or null>,
  "pensionEmployee": <pension employee contribution % / פנסיה עובד אחוז — number or null>,
  "pensionEmployer": <pension employer contribution % / פנסיה מעסיק אחוז — number or null>,
  "educationFundEmployee": <study fund employee % / קרן השתלמות עובד אחוז — number or null>,
  "educationFundEmployer": <study fund employer % / קרן השתלמות מעסיק אחוז — number or null>,
  "severanceEmployer": <severance % / פיצויים אחוז — number or null>,
  "pensionBase": <insured pension salary / שכר מבוטח לפנסיה — if multiple pension funds exist, sum their "סיס" or "בסיס" amounts — number or null>,
  "studyFundBase": <study fund base salary / בסיס קרן השתלמות — number or null>
}

Rules:
- All monetary values are plain numbers (no currency symbols, no commas).
- All percentage values are plain numbers (e.g. 6.5 not 0.065).
- If a field is not found or not readable, use null — never guess.
- CRITICAL: "gross" must be the FULL taxable gross (ברוטו לחישוב מס), not just base+overtime. It must include imputedIncome and otherTaxable items.
- CRITICAL: "imputedIncome" — scan the entire payslip for any line containing the word "שווי" or the section "זיקופי שכר". Sum ALL such lines.
- "net" is always "נטו לתשלום" — the last bottom-line figure paid to the bank, after ALL deductions.
- For multiple pension funds: sum employee % across all funds for pensionEmployee; sum employer % for pensionEmployer; sum all pension bases for pensionBase.
- For non-Israeli payslips, return only gross and/or net; set all other fields to null.`

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null
}

function clampOrNull(v: number | null, min: number, max: number): number | null {
  if (v === null) return null
  return Math.min(max, Math.max(min, v))
}

function positiveOrNull(v: number | null): number | null {
  if (v === null) return null
  return v > 0 ? v : null
}

function parsePayslipText(text: string): PayslipScanResult {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(clean) }
  catch { throw new Error('Could not parse payslip scan response') }

  return {
    gross:                    positiveOrNull(numOrNull(parsed.gross)),
    net:                      positiveOrNull(numOrNull(parsed.net)),
    base:                     positiveOrNull(numOrNull(parsed.base)),
    overtime125:              positiveOrNull(numOrNull(parsed.overtime125)),
    overtime150:              positiveOrNull(numOrNull(parsed.overtime150)),
    otherTaxable:             positiveOrNull(numOrNull(parsed.otherTaxable)),
    imputedIncome:            positiveOrNull(numOrNull(parsed.imputedIncome)),
    nonTaxableReimbursements: positiveOrNull(numOrNull(parsed.nonTaxableReimbursements)),
    taxCreditPoints:          clampOrNull(numOrNull(parsed.taxCreditPoints), 0, 20),
    pensionEmployee:          clampOrNull(numOrNull(parsed.pensionEmployee), 0, 30),
    pensionEmployer:          clampOrNull(numOrNull(parsed.pensionEmployer), 0, 30),
    educationFundEmployee:    clampOrNull(numOrNull(parsed.educationFundEmployee), 0, 20),
    educationFundEmployer:    clampOrNull(numOrNull(parsed.educationFundEmployer), 0, 20),
    severanceEmployer:        clampOrNull(numOrNull(parsed.severanceEmployer), 0, 20),
    pensionBase:              positiveOrNull(numOrNull(parsed.pensionBase)),
    studyFundBase:            positiveOrNull(numOrNull(parsed.studyFundBase)),
  }
}

export async function scanPayslip(
  fileBase64: string,
  mimeType: string,
  lang: 'en' | 'he',
): Promise<PayslipScanResult> {
  const provider = getProvider()
  if (!provider) throw new Error('No API key configured')

  // Reject files > 5 MB before making any API call
  if (fileBase64.length * 0.75 > 5 * 1024 * 1024) {
    throw new Error('File too large — use a file under 5 MB')
  }

  // Normalize unsupported MIME types to image/jpeg
  const supportedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  const normalizedMime = supportedMimes.includes(mimeType) ? mimeType : 'image/jpeg'

  const prompt = lang === 'he'
    ? PAYSLIP_PROMPT
    : PAYSLIP_PROMPT

  if (provider === 'anthropic') {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    const fileBlock: AnthropicContent = normalizedMime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image',    source: { type: 'base64', media_type: normalizedMime,       data: fileBase64 } }
    const text = await callAnthropic(apiKey, [fileBlock, { type: 'text', text: prompt }], 600)
    return parsePayslipText(text)
  }

  // Gemini
  const text = await callGemini(import.meta.env.VITE_GEMINI_API_KEY, [
    { inline_data: { mime_type: normalizedMime, data: fileBase64 } },
    { text: prompt },
  ])
  return parsePayslipText(text)
}

// ─── Receipt scan ─────────────────────────────────────────────────────────────

export async function scanReceipt(
  fileBase64: string,
  mimeType: string,
  lang: 'en' | 'he',
): Promise<ReceiptScanResult> {
  const provider = getProvider()
  if (!provider) throw new Error('No API key configured')

  const prompt = RECEIPT_PROMPT(lang)
  const normalizedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(mimeType)
    ? mimeType : 'image/jpeg'

  if (provider === 'anthropic') {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    const fileBlock: AnthropicContent = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image',    source: { type: 'base64', media_type: normalizedMime,       data: fileBase64 } }
    const text = await callAnthropic(apiKey, [fileBlock, { type: 'text', text: prompt }], 200)
    return parseReceiptText(text)
  }

  // Gemini
  const text = await callGemini(import.meta.env.VITE_GEMINI_API_KEY, [
    { inline_data: { mime_type: normalizedMime, data: fileBase64 } },
    { text: prompt },
  ])
  return parseReceiptText(text)
}
