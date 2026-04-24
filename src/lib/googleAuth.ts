/**
 * Google Identity Services (GIS) helper.
 * Loads via the script tag in index.html — no npm package needed.
 * Works in the browser only (no backend required for ID token decode).
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean
            isSkippedMoment: () => boolean
            isDismissedMoment: () => boolean
            getNotDisplayedReason: () => string
          }) => void) => void
          renderButton: (element: HTMLElement, options: object) => void
          cancel: () => void
        }
      }
    }
  }
}

// ─── JWT decode (no verification — we trust GIS to send valid tokens) ──────

export interface GoogleProfile {
  sub: string      // unique Google user id
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}

export function decodeGoogleJWT(credential: string): GoogleProfile {
  const parts = credential.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  // Base-64url → base-64 → JSON
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='))
  return JSON.parse(json) as GoogleProfile
}

// ─── GIS initialisation ────────────────────────────────────────────────────

// Replace with your actual OAuth client ID if using real Google Sign-In.
// For local-only demo mode, set this to an empty string — the button will
// be shown but sign-in will fail gracefully.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

let _callback: ((profile: GoogleProfile) => void) | null = null

function handleCredentialResponse(response: { credential: string }) {
  try {
    const profile = decodeGoogleJWT(response.credential)
    _callback?.(profile)
  } catch (e) {
    console.error('[googleAuth] Failed to decode Google JWT', e)
  }
}

/**
 * Call once on app boot (after the GIS script has loaded).
 * Pass the function that should receive the decoded profile on success.
 */
export function initGoogleAuth(onSuccess: (profile: GoogleProfile) => void) {
  _callback = onSuccess
  if (!CLIENT_ID) {
    console.warn('[googleAuth] VITE_GOOGLE_CLIENT_ID is not set — Google Sign-In disabled.')
    return
  }
  if (!window.google?.accounts?.id) {
    // Script not yet loaded — retry in 500 ms
    setTimeout(() => initGoogleAuth(onSuccess), 500)
    return
  }
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  })
}

/**
 * Trigger the One-Tap / popup prompt.
 * Returns 'ok' if the prompt was shown, or an error reason string.
 */
export function promptGoogleSignIn(): Promise<'ok' | string> {
  return new Promise((resolve) => {
    if (!CLIENT_ID || !window.google?.accounts?.id) {
      resolve('Google Sign-In is not configured (VITE_GOOGLE_CLIENT_ID missing).')
      return
    }
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        resolve(notification.getNotDisplayedReason())
      } else if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
        resolve('ok') // user dismissed — not an error
      } else {
        resolve('ok')
      }
    })
  })
}

/** Whether the GIS script and a client ID are both available */
export function isGoogleAvailable(): boolean {
  return Boolean(CLIENT_ID && window.google?.accounts?.id)
}
