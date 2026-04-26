# AI Features

## Overview

The Household Finance Planner includes two AI-powered features, both powered by Anthropic's Claude Haiku model. AI features are entirely optional — the app works fully without them. They are gated behind an environment variable and hidden from the UI if no API key is configured.

---

## Model

| Property | Value |
|----------|-------|
| **Model** | `claude-haiku-4-5` |
| **Provider** | Anthropic |
| **Characteristics** | Fast (typically 1–3s), cost-efficient, multilingual, vision-capable |
| **API** | Anthropic Messages API |
| **API version header** | `anthropic-version: 2023-06-01` |

---

## Browser-Direct API Access

Both AI features call the Anthropic API directly from the user's browser (no proxy server).

**Required header for browser-origin requests:**

```
anthropic-dangerous-direct-browser-access: true
```

This header is required by Anthropic when calling the API from a browser context (as opposed to a server). It acknowledges that the API key is visible in client-side code.

**Security implication:** The `VITE_ANTHROPIC_API_KEY` is embedded in the compiled JavaScript bundle. Any user who inspects the source can read the key. Mitigation options for production deployments include:

- Using a proxy endpoint that adds the key server-side
- Restricting the key to specific API methods in the Anthropic dashboard
- Rotating the key regularly

For a household-scale private app, the current approach is acceptable.

---

## Availability Gate

All AI features check for the API key at runtime before rendering any AI-related UI:

```typescript
const aiEnabled = !!import.meta.env.VITE_ANTHROPIC_API_KEY
```

If `aiEnabled` is `false`:
- The "Explain my plan" button in the Goals tab is hidden
- The "Scan receipt" button in the Expenses tab is hidden
- No API calls are made
- The app is fully functional without AI

If `aiEnabled` is `true` and an API call fails (network error, rate limit, invalid key):
- An inline error message is shown within the relevant card
- The user can retry by clicking the button again
- The rest of the app is unaffected

---

## Feature 1 — Goal Plan Explanation

### Location
Goals tab → Allocation Plan card → "Explain my plan" button

### Purpose
Gives a plain-language assessment of the household's savings plan — which goals are on track, which are at risk, and what to do about it.

### Input payload

```typescript
interface GoalPlanPayload {
  goals: GoalAllocation[]   // Full allocation results (status, amounts, deadlines)
  freeCashFlow: number      // FCF figure the engine used
  currency: string          // e.g. 'ILS', 'USD'
  lang: 'en' | 'he'        // App language — AI responds in the same language
}
```

### API call

```typescript
await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: buildGoalPrompt(payload) }],
  }),
})
```

### Prompt instructions (summary)

The model is instructed to:

1. Briefly assess the overall health of the savings plan in plain, friendly language
2. Call out goals that are Unrealistic or Blocked and explain why in one sentence each
3. Offer exactly two concrete, actionable suggestions to improve the plan
4. Respond in `payload.lang` (English or Hebrew)
5. Keep the total response under 200 words

### Output

Plain text, displayed in a scrollable collapsible card (`max-h-[40vh] overflow-y-auto`) below the Allocation Plan table.

### Max tokens: 400

---

## Feature 2 — Receipt Scan

### Location
Expenses tab → "Scan receipt" button (camera icon in the toolbar)

### Purpose
Lets the user photograph or upload a receipt and have the expense details (name, amount, category) pre-filled in the Add Expense dialog — eliminating manual entry.

### Input

```typescript
interface ReceiptScanInput {
  imageBase64: string   // Base64-encoded image bytes
  mimeType: string      // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}
```

The image is read from the file input as a base64 string in the browser. The bytes are passed directly to the API and **never stored** anywhere — not in localStorage, not in Supabase, not in any log.

### API call

```typescript
await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.mimeType,
            data: input.imageBase64,
          },
        },
        {
          type: 'text',
          text: buildReceiptPrompt(),
        },
      ],
    }],
  }),
})
```

### Prompt instructions (summary)

The model is instructed to:

1. Extract the merchant/item name, total amount, and best-matching expense category from the receipt
2. Return **only** a JSON object — no markdown fencing, no explanation
3. Use this exact schema: `{ "name": string, "amount": number, "category": string }`
4. If any field cannot be determined, return `null` for that field

### Output parsing and validation

The raw text response is parsed as JSON. Each field is then validated and sanitised:

```typescript
function parseReceiptResponse(raw: string): ReceiptScanResult {
  const parsed = JSON.parse(raw)

  return {
    name: typeof parsed.name === 'string'
      ? parsed.name.slice(0, 60)          // Truncate to 60 characters
      : null,

    amount: typeof parsed.amount === 'number'
      ? Math.max(0, parsed.amount)        // Clamp to ≥ 0
      : null,

    category: EXPENSE_CATEGORIES.includes(parsed.category)
      ? parsed.category                   // Only accept valid categories
      : null,
  }
}
```

Validation rules:
- **Name:** truncated to 60 characters; invalid types become `null`
- **Amount:** clamped to ≥ 0; invalid types become `null`
- **Category:** checked against `EXPENSE_CATEGORIES` list; unknown categories become `null`

If parsing fails entirely (malformed JSON), all three fields are `null` and an error is shown to the user.

### Privacy

- The receipt image exists in memory only during the API call
- After the response is received, the base64 bytes are discarded
- No image data is written to localStorage, Supabase, or any other persistent store
- The Add Expense dialog is pre-filled with the extracted values; the user reviews and confirms before saving

### Max tokens: 200

---

## File Location

All AI logic lives in `src/lib/aiAdvisor.ts`:

```
src/lib/aiAdvisor.ts
  ├── explainGoalPlan(payload: GoalPlanPayload): Promise<AiResult>
  └── scanReceipt(input: ReceiptScanInput): Promise<ReceiptScanResult>
```

Neither function throws — both return result objects with an `ok` boolean:

```typescript
type AiResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

type ReceiptScanResult = {
  ok: boolean
  name: string | null
  amount: number | null
  category: string | null
  error?: string
}
```

---

## Test Coverage

| Test file | Tests | What is covered |
|-----------|-------|----------------|
| `src/test/receiptScan.test.ts` | 20 | JSON parsing, name truncation, amount clamping, unknown category → null, malformed JSON error, null fields, edge amounts (0, negative, very large) |

The tests cover the parsing and validation logic only. The API call itself is mocked — no real HTTP requests are made in tests.

### Running the tests

```bash
npm test                      # All 300 tests, including receipt scan
npm run test:watch            # Watch mode
```

---

## Adding a New AI Feature

1. Add a new exported function to `src/lib/aiAdvisor.ts` with a result type that includes `ok: boolean`.
2. Gate the feature in the UI with `const aiEnabled = !!import.meta.env.VITE_ANTHROPIC_API_KEY`.
3. Use `claude-haiku-4-5` unless the feature requires vision or longer reasoning.
4. Always include the `anthropic-dangerous-direct-browser-access: true` header.
5. Never store user data (images, personal details) beyond the duration of the API call.
6. Write tests for the parsing and validation logic in `src/test/`.
7. Document the feature here in `docs/_shared/ai-features.md`.
