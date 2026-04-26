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

export async function explainGoalPlan(
  payload: GoalPlanPayload,
  lang: 'en' | 'he',
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No API key configured')

  const prompt = `You are a personal finance advisor. The user has the following savings goals and allocation plan:

${JSON.stringify(payload, null, 2)}

Please provide:
1. A brief assessment of whether this plan is realistic
2. Which goals (if any) are at risk of not being met
3. 1-2 specific actionable suggestions to improve the plan

Keep your response concise (under 200 words). Be encouraging but honest.${lang === 'he' ? ' Please respond in Hebrew.' : ''}`

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
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json()
  return data.content[0].text
}

export const aiEnabled = !!import.meta.env.VITE_ANTHROPIC_API_KEY

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
 * Send a receipt image to Claude Vision and extract expense fields.
 * Returns { name, amount, category } — all fields are best-effort; callers
 * should validate and let the user review before saving.
 *
 * @param imageBase64 - Raw base64 string (no data-URL prefix)
 * @param mimeType    - e.g. "image/jpeg", "image/png", "image/webp"
 * @param lang        - Response hint language
 */
export async function scanReceipt(
  imageBase64: string,
  mimeType: string,
  lang: 'en' | 'he',
): Promise<ReceiptScanResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No API key configured')

  const prompt = `You are a receipt parser. Look at this receipt image and extract the following fields.
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
${lang === 'he' ? '- The app is in Hebrew. Transliterate or translate the merchant name to Hebrew if it is clearly in Hebrew on the receipt.' : ''}`

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
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json()
  const text: string = data.content[0].text.trim()

  // Strip markdown code fences if model wraps the JSON
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('Could not parse receipt scan response')
  }

  const name     = typeof parsed.name   === 'string' ? parsed.name.slice(0, 60)   : 'Receipt'
  const amount   = typeof parsed.amount === 'number' ? Math.max(0, parsed.amount)  : 0
  const catRaw   = typeof parsed.category === 'string' ? parsed.category.toLowerCase().trim() : 'other'
  const category = (VALID_CATEGORIES as readonly string[]).includes(catRaw) ? catRaw : 'other'

  return { name, amount, category }
}
