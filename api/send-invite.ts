/**
 * POST /api/send-invite
 *
 * Vercel serverless function — runs server-side so RESEND_API_KEY is never
 * exposed in the browser bundle.
 *
 * Body: { email, inviteUrl, householdName, inviterName }
 *
 * Setup:
 *  1. Create a free account at https://resend.com
 *  2. Verify your sending domain (household-finance-planner.com)
 *  3. Generate an API key
 *  4. In Vercel → Project → Settings → Environment Variables:
 *     Add RESEND_API_KEY (no VITE_ prefix — must stay server-side)
 *
 * Without RESEND_API_KEY the endpoint returns 503 so the frontend can
 * fall back to showing the invite URL for manual sharing.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── API key guard — fail early and clearly ────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.warn('[send-invite] RESEND_API_KEY is not set — email sending disabled')
    return res.status(503).json({ error: 'EMAIL_NOT_CONFIGURED' })
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const { email, inviteUrl, householdName, inviterName } = req.body as {
    email?: string
    inviteUrl?: string
    householdName?: string
    inviterName?: string
  }

  if (!email || !inviteUrl || !householdName) {
    return res.status(400).json({ error: 'Missing required fields: email, inviteUrl, householdName' })
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  // ── Send via Resend ───────────────────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: 'Household Finance Planner <invites@household-finance-planner.com>',
      to: email,
      subject: `${inviterName ?? 'Someone'} invited you to join their household budget`,
      html: buildEmailHtml({
        inviterName: inviterName ?? 'Your partner',
        householdName,
        inviteUrl,
      }),
    })

    if (error) {
      // Resend returned an API-level error (bad domain, quota, etc.)
      console.error('[send-invite] Resend API error:', error)
      return res.status(502).json({ error: error.message })
    }

    console.log(`[send-invite] Email sent to ${email} for household "${householdName}"`)
    return res.status(200).json({ ok: true })

  } catch (e) {
    // Network / unexpected error
    console.error('[send-invite] Unexpected error:', e)
    return res.status(500).json({ error: 'Failed to send invite email. Please try again.' })
  }
}

// ── Email template ────────────────────────────────────────────────────────

function buildEmailHtml({
  inviterName,
  householdName,
  inviteUrl,
}: {
  inviterName: string
  householdName: string
  inviteUrl: string
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You're invited</title>
</head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:36px 32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">

    <!-- Logo block -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;background:#0d9488;border-radius:14px">
        <span style="font-size:26px;line-height:1">💰</span>
      </div>
      <p style="margin:10px 0 0;font-size:13px;color:#9ca3af;letter-spacing:.04em;text-transform:uppercase">
        Household Finance Planner
      </p>
    </div>

    <!-- Headline -->
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#111827;text-align:center">
      You're invited! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;text-align:center;line-height:1.6">
      <strong>${inviterName}</strong> has invited you to join
      <strong>${householdName}</strong> on Household Finance Planner.
    </p>

    <!-- Description -->
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;text-align:center;line-height:1.65">
      Plan your household budget together — track income, expenses,
      savings goals, and more. Your financial data stays private on
      your own device.
    </p>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:28px">
      <a href="${inviteUrl}"
         style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:600;font-size:15px">
        Accept Invitation →
      </a>
    </div>

    <!-- Expiry note -->
    <p style="margin:0 0 12px;font-size:12px;color:#9ca3af;text-align:center">
      This link expires in <strong>7 days</strong>.
    </p>

    <!-- Fallback URL -->
    <div style="background:#f3f4f6;border-radius:8px;padding:12px;word-break:break-all">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">
        Or paste this link in your browser
      </p>
      <span style="font-size:12px;color:#0d9488;font-family:monospace">${inviteUrl}</span>
    </div>

  </div>
</body>
</html>
  `.trim()
}
