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
