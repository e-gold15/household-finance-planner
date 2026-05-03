# Feature Spec: Fix Google Sign-In on Custom Domain

**Version:** v3.2
**Date:** 2026-05-03
**Status:** Ready for implementation

---

## Feature: Fix Google Sign-In on Custom Domain

**Problem:** Google Sign-In fails on https://household-finance-planner.com because the domain is not listed as an Authorised JavaScript Origin in the Google Cloud Console OAuth 2.0 client configuration. The GIS library rejects `initialize()` calls from unlisted origins, so the button either fails silently or logs a `idpiframe_initialization_failed` error. Users on the live domain cannot sign in with Google and lose access to cross-device sync and household recovery.

**Users affected:** All three personas — anyone who signed up or intends to sign up with Google Sign-In on the production URL.

**Proposed solution:** Register the production domain in Google Cloud Console as an Authorised JavaScript Origin. No code changes are required. `googleAuth.ts` already reads `VITE_GOOGLE_CLIENT_ID` from env, and `VITE_GOOGLE_CLIENT_ID` is already configured in Vercel. This is a one-time console configuration task followed by verification.

---

### Steps to fix

This is an infra/config fix. There are no code changes needed in `googleAuth.ts` or any other source file.

**Step 1 — Google Cloud Console**

1. Open https://console.cloud.google.com
2. Navigate to APIs & Services → Credentials
3. Select the OAuth 2.0 Client ID associated with `VITE_GOOGLE_CLIENT_ID`
4. Under "Authorised JavaScript origins", confirm the following entries are present (add any that are missing):
   - `https://household-finance-planner.com`
   - `http://localhost:5173`
5. Under "Authorised redirect URIs" — no changes needed. GIS uses the postMessage flow, not redirect URIs.
6. Click Save
7. Wait up to 5 minutes for changes to propagate before testing

**Step 2 — Verify Vercel environment variable**

1. Open Vercel Dashboard → Project → Settings → Environment Variables
2. Confirm `VITE_GOOGLE_CLIENT_ID` is set for the Production environment and its value matches the Client ID from Step 1
3. If the value was missing or changed, trigger a redeploy: Vercel Dashboard → Deployments → Redeploy latest

**Step 3 — Verify locally (optional)**

1. Confirm `VITE_GOOGLE_CLIENT_ID` is set in `.env.local`
2. Run `npm run dev` and confirm the Google button renders and completes sign-in at `http://localhost:5173`

---

### Acceptance criteria

- [ ] Google Sign-In button renders correctly on https://household-finance-planner.com (not blank, not "G" icon only)
- [ ] Clicking the button opens the Google account chooser popup without error
- [ ] Completing Google Sign-In lands the user in their household with finance data loaded
- [ ] Works in an incognito window (no cached session)
- [ ] Works on mobile Safari and Chrome (375px viewport)
- [ ] Works in Hebrew RTL — button layout does not break when language is toggled to Hebrew
- [ ] `isGoogleAvailable()` returns `true` in the browser console on the live domain
- [ ] No `idpiframe_initialization_failed` or `origin_mismatch` errors appear in the browser console
- [ ] Cross-device: signing in with Google on a second device restores the correct household silently (no "welcome" banner)
- [ ] Email sign-in continues to work (no regression)

---

### Out of scope

- Changes to `googleAuth.ts` — the implementation is correct; this is a config-only fix
- Changes to `VITE_GOOGLE_CLIENT_ID` value — only the authorised origins list needs updating
- One-Tap / auto-select prompt behaviour — not required to work; the explicit button is sufficient
- Google Sign-In for preview deployment URLs (`*.vercel.app`) — out of scope for this fix; only the custom domain is required
- Password reset / forgot password flow
- Any changes to Supabase schema or RLS policies

---

### Success metric

Google Sign-In completes successfully on https://household-finance-planner.com in a fresh incognito session on both desktop and mobile, with no console errors related to OAuth origin validation.
