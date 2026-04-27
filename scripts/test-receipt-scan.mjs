/**
 * Standalone receipt-scan test script.
 * Run with:   ANTHROPIC_API_KEY=sk-... node scripts/test-receipt-scan.mjs <path-to-file>
 *
 * Supports:
 *   - JPEG / PNG / WebP images → inline base64 (single request)
 *   - PDF files               → Files API upload (two requests)
 *
 * Example:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/test-receipt-scan.mjs \
 *     ~/Downloads/1e12fe56-583d-48f7-bdeb-0cbf39d6f00a.pdf
 */

import { readFileSync } from 'fs'
import { extname } from 'path'

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY env var is required')
  process.exit(1)
}

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: ANTHROPIC_API_KEY=sk-... node scripts/test-receipt-scan.mjs <path>')
  process.exit(1)
}

const ext = extname(filePath).toLowerCase()
const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' }
const mimeType = mimeMap[ext] ?? 'image/jpeg'
const isPdf = mimeType === 'application/pdf'

console.log(`\nFile : ${filePath}`)
console.log(`MIME : ${mimeType}`)
console.log(`Mode : ${isPdf ? 'PDF → Files API (2 requests)' : 'Image → inline base64 (1 request)'}\n`)

const fileBuffer = readFileSync(filePath)
const fileBase64 = fileBuffer.toString('base64')
console.log(`Size : ${(fileBuffer.length / 1024).toFixed(1)} KB`)

const BASE_HEADERS = {
  'x-api-key': API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
}

const PROMPT = `You are a receipt parser. Look at this receipt and extract the following fields.
Return ONLY a JSON object with exactly these keys — no markdown, no explanation:
{
  "name": "<merchant or store name, max 40 chars>",
  "amount": <total amount as a number, no currency symbol>,
  "category": "<one of: housing, food, transport, education, leisure, health, utilities, clothing, insurance, savings, other>"
}

Rules:
- "amount" must be the final total paid (including tax), as a plain number.
- "category" must be exactly one of the listed values.
- If the merchant is a supermarket/restaurant → "food". Gas station → "transport". Pharmacy/clinic → "health".
- If you cannot read the amount, use 0.
- If you cannot read the merchant name, use "Receipt".`

async function run() {
  let fileContentBlock
  const msgHeaders = { ...BASE_HEADERS, 'Content-Type': 'application/json' }

  if (isPdf) {
    // ── Step 1: upload to Files API ────────────────────────────────────────────
    console.log('Step 1: Uploading PDF to Files API…')

    // Build FormData manually (Node 18+)
    const boundary = '----FormBoundary' + Math.random().toString(16).slice(2)
    const pdfBlob = fileBuffer

    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="receipt.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      'utf-8'
    )
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    const body = Buffer.concat([prefix, pdfBlob, suffix])

    const uploadRes = await fetch('https://api.anthropic.com/v1/files', {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        'anthropic-beta': 'files-api-2025-04-14',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })

    const uploadJson = await uploadRes.json()
    console.log(`Upload status : ${uploadRes.status}`)
    console.log('Upload body  :', JSON.stringify(uploadJson, null, 2))

    if (!uploadRes.ok) {
      console.error('\nFAILED at Files API upload step')
      process.exit(1)
    }

    const fileId = uploadJson.id
    console.log(`\nfile_id      : ${fileId}`)
    fileContentBlock = { type: 'document', source: { type: 'file', file_id: fileId } }
    msgHeaders['anthropic-beta'] = 'files-api-2025-04-14'
  } else {
    // ── Images: inline base64 ─────────────────────────────────────────────────
    const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const normalizedMime = SUPPORTED.includes(mimeType) ? mimeType : 'image/jpeg'
    fileContentBlock = { type: 'image', source: { type: 'base64', media_type: normalizedMime, data: fileBase64 } }
  }

  // ── Step 2 (or only step): /v1/messages ──────────────────────────────────────
  console.log('\n' + (isPdf ? 'Step 2: ' : '') + 'Sending to /v1/messages…')

  const msgRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: msgHeaders,
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [fileContentBlock, { type: 'text', text: PROMPT }],
        },
      ],
    }),
  })

  const msgJson = await msgRes.json()
  console.log(`Messages status : ${msgRes.status}`)
  console.log('Messages body  :', JSON.stringify(msgJson, null, 2))

  if (!msgRes.ok) {
    console.error('\nFAILED at /v1/messages step')
    process.exit(1)
  }

  const rawText = msgJson.content?.[0]?.text ?? ''
  console.log('\nRaw model output:', rawText)

  // Parse
  const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const parsed = JSON.parse(clean)
    console.log('\n✅ Parsed result:')
    console.log(`  name     : ${parsed.name}`)
    console.log(`  amount   : ${parsed.amount}`)
    console.log(`  category : ${parsed.category}`)
  } catch {
    console.error('\n❌ Could not parse JSON from model output:', clean)
    process.exit(1)
  }
}

run().catch(err => { console.error('\nUnexpected error:', err); process.exit(1) })
