/**
 * Client-side wrapper for the /api/send-invite Vercel serverless route.
 *
 * In local dev (npm run dev) the /api/ routes are not served by Vite —
 * use `vercel dev` to test email locally. In production (Vercel) this
 * works automatically.
 *
 * Never put RESEND_API_KEY in a VITE_ variable — it would be exposed
 * in the browser bundle. The API key lives only in the serverless function.
 */

export interface SendInviteEmailOptions {
  email: string
  inviteUrl: string
  householdName: string
  inviterName: string
}

export type SendInviteEmailResult =
  | { ok: true }
  | { error: string; notConfigured?: boolean }

/**
 * Ask the /api/send-invite serverless function to deliver an invite email.
 *
 * Returns `{ ok: true }` on success.
 * Returns `{ error, notConfigured: true }` when RESEND_API_KEY is not set
 *   — caller should fall back to showing the URL for manual sharing.
 * Returns `{ error }` on any other failure.
 */
export async function sendInviteEmail(
  opts: SendInviteEmailOptions
): Promise<SendInviteEmailResult> {
  try {
    const res = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })

    // Parse body regardless of status (errors include a message)
    let data: Record<string, unknown> = {}
    try { data = await res.json() } catch { /* empty body */ }

    if (res.ok) return { ok: true }

    // 503 means the server-side key is missing — tell the caller
    if (res.status === 503 && data.error === 'EMAIL_NOT_CONFIGURED') {
      return { error: 'Email sending is not configured on this server.', notConfigured: true }
    }

    return { error: (data.error as string) ?? `HTTP ${res.status}` }
  } catch {
    // Fetch itself failed (offline, dev server, etc.)
    return { error: 'Email service is unavailable. Share the invite link manually.' }
  }
}
