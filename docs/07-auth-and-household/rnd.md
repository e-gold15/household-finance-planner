# Auth & Household — Engineering Reference

## Key Files

| File | Responsibility |
|------|---------------|
| `src/lib/localAuth.ts` | User CRUD, password hashing, session management, household CRUD, `migrateIfNeeded()` |
| `src/lib/googleAuth.ts` | Google GIS integration — `renderButton()`, JWT decode, profile extraction |
| `src/lib/cloudInvites.ts` | Supabase CRUD for households, memberships, invites, user profiles |
| `src/lib/cloudFinance.ts` | Supabase finance sync — push, pull, merge |
| `src/context/AuthContext.tsx` | React context — exposes `useAuth()`, session state, sign-in/out methods |

---

## SHA-256 Password Hashing

Located in `src/lib/localAuth.ts`.

```typescript
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

**Dependencies:** Zero. `crypto.subtle` is a built-in browser API available in all modern browsers and in the Vite dev server (via Node's WebCrypto polyfill in tests).

**Test environment:** `src/test/setup.ts` mocks `crypto.subtle.digest` for deterministic test output.

**Sign-in verification:**
```typescript
const inputHash = await hashPassword(submittedPassword)
const match = user.passwordHash === inputHash
```

---

## Google GIS Integration

Located in `src/lib/googleAuth.ts`.

### Button rendering

```typescript
google.accounts.id.renderButton(
  document.getElementById('google-signin-button'),
  {
    type: 'standard',
    shape: 'rectangular',
    theme: 'outline',
    size: 'large',
    width: 400,
  }
)
```

The button is rendered by Google's own JavaScript. The app cannot change its appearance beyond the parameters above (Google Brand Guidelines).

### JWT decoding

When the user clicks the Google button, Google calls the app's registered callback with a credential (JWT). The app decodes this client-side:

```typescript
function decodeGoogleJwt(credential: string): GoogleProfile {
  const payload = JSON.parse(atob(credential.split('.')[1]))
  return {
    id: payload.sub,           // Google user ID — stable, never changes
    name: payload.name,
    email: payload.email,
    avatar: payload.picture,
  }
}
```

**No server-side verification:** The JWT signature is not verified client-side (this would require the Google public key). The app trusts the credential because it was delivered directly from Google's GIS iframe — the same-origin and HTTPS constraints make spoofing the callback impractical. For a higher-assurance deployment, the credential should be verified server-side.

---

## Cloud Invite Token Security

Located in `src/lib/cloudInvites.ts`.

### Token generation

```typescript
const rawToken = crypto.randomUUID()  // 128-bit random, cryptographically secure
const tokenHash = await sha256hex(rawToken)
```

### Storage

- `rawToken` is embedded in the invite URL: `https://household-finance-planner.com/invite?token=<rawToken>`
- `tokenHash` is stored in Supabase `household_invites.token_hash`
- `rawToken` is **never stored** — not in Supabase, not in localStorage, not in logs

### Acceptance

```typescript
const submittedToken = new URLSearchParams(location.search).get('token')
const submittedHash = await sha256hex(submittedToken)

const invite = await supabase
  .from('household_invites')
  .select('*')
  .eq('token_hash', submittedHash)
  .eq('status', 'pending')
  .single()
```

If no matching row is found (wrong token, already accepted, expired, or revoked), the invite is rejected.

### Expiry enforcement

Expiry is enforced in two places:
1. **Supabase query filter:** `.gt('expires_at', new Date().toISOString())` — the database rejects expired invites.
2. **UI display:** Pending invites with past `expires_at` are shown with an "Expired" badge in the Household Settings dialog.

---

## Cloud Finance Sync

Located in `src/lib/cloudFinance.ts`.

### Mount sequence

```typescript
// FinanceContext useEffect on mount:
useEffect(() => {
  const cloudData = await fetchCloudFinanceData(householdId)
  if (cloudData) {
    const merged = mergeFinanceData(localData, cloudData)
    const repaired = repairSnapshotTotals(merged)
    setDataState(repaired)
    localStorage.setItem(`hf-data-${householdId}`, JSON.stringify(repaired))
  } else if (localData) {
    // No cloud row — seed the cloud (first time on this household)
    await pushCloudFinanceData(householdId, localData)
  }
}, [householdId])
```

### Debounced push

```typescript
// On every setData() call inside FinanceContext:
const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function setData(updater) {
  setDataState(prev => {
    const next = updater(prev)
    localStorage.setItem(`hf-data-${householdId}`, JSON.stringify(next))

    // Debounce cloud push
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => {
      pushCloudFinanceData(householdId, next)
    }, 1500)

    return next
  })
}
```

The timer reference is stored in a `useRef` (not `useState`) to avoid re-renders. The timer is cleared in a `useEffect` cleanup to prevent memory leaks when the component unmounts.

### `mergeFinanceData`

```typescript
function mergeFinanceData(local: FinanceData, cloud: FinanceData): FinanceData {
  return {
    ...cloud,                    // Cloud wins on all financial fields
    darkMode: local.darkMode,    // Local wins on UI prefs
    language: local.language,
  }
}
```

---

## `migrateIfNeeded()`

Located in `src/lib/localAuth.ts`.

```typescript
function migrateIfNeeded(): void {
  // Example: add householdId to legacy users who lack it
  const users: LocalUser[] = JSON.parse(localStorage.getItem('hf-users') ?? '[]')
  const migrated = users.map(u => ({
    householdId: u.householdId ?? generateDefaultHouseholdId(u),
    ...u,
  }))
  localStorage.setItem('hf-users', JSON.stringify(migrated))
}
```

**Properties:**
- **Idempotent** — calling it multiple times produces the same result as calling it once
- **Safe to call on every mount** — `AuthProvider` calls it on every initialisation
- New migration steps are appended at the bottom of the function; old steps are never removed (they safely no-op on already-migrated data)

---

## Security Rules (must never be violated)

| Rule | Enforcement |
|------|-------------|
| No `hf-` localStorage keys outside `localAuth.ts` | Code review; `eslint-plugin-no-restricted-syntax` rule (planned) |
| No Supabase Auth — auth is always local | No `supabase.auth.*` calls anywhere in the codebase |
| No `VITE_SUPABASE_SERVICE_ROLE_KEY` in source | Vercel environment variable audit; never committed to repo |
| Passwords never logged | No `console.log(password)` — hashing happens before any logging |
| Supabase functions no-op if `!supabaseConfigured` | Guard at top of every Supabase function: `if (!supabaseConfigured) return null` |
| Invite raw token never stored | Raw token discarded after URL construction; only hash persisted |

---

## Test Coverage

| Test file | Tests | What is covered |
|-----------|-------|----------------|
| `src/test/localAuth.test.ts` | 15 | `signUp`, `signIn`, session creation/retrieval, invite creation, invite acceptance, `migrateIfNeeded` idempotency |
| `src/test/cloudInvites.test.ts` | 57 | Token generation, token hashing, invite revocation, `fetchUserMemberships`, cross-device recovery logic, expired invite rejection |
| `src/test/cloudFinance.test.ts` | 24 | `mergeFinanceData` conflict resolution, push/pull no-ops when Supabase is unconfigured, `repairSnapshotTotals` post-merge |

**Total: 96 tests** covering the auth and household feature set.

### Running tests

```bash
npm test                      # All 300 tests
npm run test:watch            # Watch mode
```

---

## Adding a New Auth Feature

1. Add any new types to `src/types/index.ts`.
2. Implement logic in `src/lib/localAuth.ts` (local) or `src/lib/cloudInvites.ts` (Supabase).
3. Expose the new method through `AuthContext.tsx` — add it to the `AuthContextType` interface.
4. Write tests in `src/test/localAuth.test.ts` covering happy path, error path, and idempotency (if applicable).
5. Run `npm test` and `npm run build` before committing.
6. Document any new `localStorage` keys in `README.md`.
