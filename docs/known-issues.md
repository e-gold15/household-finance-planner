# Known Issues & Limitations

---

## Finance Data Is Not Shared Between Devices

Two household members entering data on different devices will have separate `FinanceData`. The household model groups users for invites and membership, but financial data remains device-local.

**Impact:** If both partners use the app, they each enter their own data on their own device and see different numbers.

**Planned fix (v3):** Optional cloud sync of `FinanceData` to Supabase — opt-in, encrypted, privacy-preserving.

---

## Google Sign-In Requires Domain Whitelisting

`renderGoogleButton()` silently renders blank if the current domain isn't listed in Google Cloud Console's **Authorized JavaScript origins**. No error is thrown — the button just doesn't appear.

**Fix:** Add `https://household-finance-planner.com` and `http://localhost:5173` to the OAuth client's authorized origins. See [deployment.md](./deployment.md#google-sign-in-setup).

**Fallback:** If GIS doesn't load within 6 seconds, a clickable "Continue with Google" fallback button is shown. Email auth always works regardless.

---

## Link Invite Token Lost on Page Reload

When an owner generates a shareable link invite, the raw token is held in component memory (`liveToken` state) for that session only. On page reload the token is gone — it was never stored.

**Workaround:** Owner clicks "Regenerate" to get a new copyable URL. The old link is revoked and a new one is created.

**Why this is intentional:** Storing the raw token (even in `localStorage`) would create a persistent copy that could be leaked. Regenerating is a minor UX inconvenience that avoids a security issue.

---

## SHA-256 for Password Hashing

SHA-256 is a general-purpose hash, not a password-specific function (no bcrypt/argon2/scrypt). This is acceptable for a local-only app where the hash never leaves the device, but is not suitable for a server-side auth system.

**Mitigation:** The hash never travels to Supabase or any server. It lives only in `hf-users` in `localStorage`.

---

## Supabase Anon Key Is Public

The anon key is in the browser bundle (all `VITE_` env vars are). This is expected and safe — it's the public key, designed to be used from the browser. The service role key must never be set as a `VITE_` variable.

The `allow_all` RLS policy is intentional because auth is handled locally. There is no Supabase Auth session to enforce row-level access.

---

## localStorage Size Limit

Browsers enforce approximately 5 MB per origin. With large history snapshots and many households this could be approached over time.

**Mitigation:** History snapshots are manually triggered — the user controls how many are stored. Export and re-import data to compress/clean up old snapshots.

---

## `crypto.randomUUID` Mock in Tests

`setup.ts` mocks `crypto.randomUUID` with a simple incrementing counter (`test-uuid-{n}`). Tests that need truly unique IDs across parallel test files may see collisions. Prefer `generateId()` (which uses `Math.random`) in new test helpers rather than relying on `randomUUID`.

---

## RTL Charts

Recharts doesn't natively support RTL axis mirroring. When `lang = 'he'` is active, chart axes are not mirrored. Numbers and data display correctly, but the visual direction of the chart may feel inconsistent with RTL text around it.

**Planned fix:** Wrap Recharts with explicit `direction: ltr` on the chart container to keep charts LTR regardless of page direction.

---

## No Offline / PWA Support

The app requires an internet connection to load (Vite serves from a CDN). Once loaded, all finance operations work offline (localStorage only). But invite acceptance requires Supabase connectivity.

**Planned fix (v3):** Mobile PWA with service worker for offline-first loading.
