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

// ── Gemini helpers ─────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash'

function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

interface GeminiTextPart   { text: string }
interface GeminiInlinePart { inline_data: { mime_type: string; data: string } }
type GeminiPart = GeminiTextPart | GeminiInlinePart

async function callGemini(apiKey: string, parts: GeminiPart[]): Promise<string> {
  const response = await fetch(geminiUrl(apiKey), {
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

// ── AI enabled flag ────────────────────────────────────────────────────────────

export const aiEnabled = !!import.meta.env.VITE_GEMINI_API_KEY

// ── Goal plan explainer ────────────────────────────────────────────────────────

export async function explainGoalPlan(
  payload: GoalPlanPayload,
  lang: 'en' | 'he',
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('No API key configured')

  const prompt = `You are a personal finance advisor. The user has the following savings goals and allocation plan:

${JSON.stringify(payload, null, 2)}

Please provide:
1. A brief assessment of whether this plan is realistic
2. Which goals (if any) are at risk of not being met
3. 1-2 specific actionable suggestions to improve the plan

Keep your response concise (under 200 words). Be encouraging but honest.${lang === 'he' ? ' Please respond in Hebrew.' : ''}`

  return callGemini(apiKey, [{ text: prompt }])
}

// ─── Receipt scan ─────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  name: string         // merchant / store name
  amount: number       // total amount paid (positive number)
  category: string     // one of the EXPENSE_CATEGORIES values
}

const VALID_CATEGORIES = [
  'housing', 'food', 'transport', 'education', 'leisure',
  'health', 'utilities', 'clothing', 'insurance', 'savings', 'other',
] as const

/**
 * Send a receipt image or PDF to Gemini and extract expense fields.
 *
 * Images and PDFs are sent as inline base64 in a single POST —
 * no upload step, no CORS preflight issues from the browser.
 *
 * @param fileBase64 - Raw base64 string (no data-URL prefix)
 * @param mimeType   - e.g. "image/jpeg", "image/png", "image/webp", "application/pdf"
 * @param lang       - Response hint language
 */
export async function scanReceipt(
  fileBase64: string,
  mimeType: string,
  lang: 'en' | 'he',
): Promise<ReceiptScanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('No API key configured')

  const prompt = `You are a receipt parser. Look at this receipt and extract the following fields.
Return ONLY a JSON object with exactly these keys — no markdown, no explanation:
{
  "name": "<merchant or store name, max 40 chars>",
  "amount": <total amount as a number, no currency symbol>,
  "category": "<one of: housing, food, transport, education, leisure, health, utilities, clothing, insurance, savings, other>"
}

Rules:
- "amount" must be the final total paid (including tax), as a plain number.
- "category" must be exactly one of the listed values.
- If the merchant is a supermarket/restaurant → "food". Gas station → "transport". Pharmacy/clinic → "health". Clothing store → "clothing". Utility bill → "utilities". Rent/mortgage → "housing". School/course → "education". Cinema/entertainment → "leisure". Insurance → "insurance". Bank transfer/savings → "savings". Anything else → "other".
- If you cannot read the amount, use 0.
- If you cannot read the merchant name, use "Receipt".
${lang === 'he' ? '- The app is in Hebrew. Keep merchant names in their original language (Hebrew or English as printed on the receipt).' : '- Keep merchant names in their original language as printed on the receipt.'}`

  // Normalize mime type — Gemini supports jpeg/png/gif/webp/pdf inline
  const normalizedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(mimeType)
    ? mimeType
    : 'image/jpeg'

  const text = await callGemini(apiKey, [
    { inline_data: { mime_type: normalizedMime, data: fileBase64 } },
    { text: prompt },
  ])

  // Strip markdown code fences if model wraps the JSON
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('Could not parse receipt scan response')
  }

  const name     = typeof parsed.name     === 'string' ? parsed.name.slice(0, 60)   : 'Receipt'
  const amount   = typeof parsed.amount   === 'number' ? Math.max(0, parsed.amount) : 0
  const catRaw   = typeof parsed.category === 'string' ? parsed.category.toLowerCase().trim() : 'other'
  const category = (VALID_CATEGORIES as readonly string[]).includes(catRaw) ? catRaw : 'other'

  return { name, amount, category }
}
