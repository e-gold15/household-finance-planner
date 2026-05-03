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
  'health', 'utilities', 'clothing', 'insurance', 'savings', 'other',
] as const

const RECEIPT_PROMPT = (lang: 'en' | 'he') => `You are a receipt parser. Look at this receipt and extract the following fields.
Return ONLY a JSON object with exactly these keys — no markdown, no explanation:
{
  "name": "<merchant or store name, max 40 chars>",
  "amount": <total amount as a number, no currency symbol>,
  "category": "<one of: housing, food, transport, education, leisure, health, utilities, clothing, insurance, savings, other>"
}

Rules:
- "amount" must be the final total paid (including tax), as a plain number.
- "category" must be exactly one of the listed values.
- Supermarket/restaurant → "food". Gas station → "transport". Pharmacy/clinic → "health". Clothing store → "clothing". Utility bill → "utilities". Rent/mortgage → "housing". School/course → "education". Cinema/entertainment → "leisure". Insurance → "insurance". Bank/savings → "savings". Anything else → "other".
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
