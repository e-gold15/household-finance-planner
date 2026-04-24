# Authentication System

The app uses **local-first authentication** — passwords are hashed with SHA-256 in the browser using the Web Crypto API. There is no Supabase Auth, no JWT sessions, no server-side validation. Google Sign-In is handled via Google Identity Services (GIS) with the credential validated client-side by decoding the JWT.

---

## `src/lib/localAuth.ts`

Core auth module. All data lives in `localStorage`. Functions are synchronous except password hashing.

### Storage keys

| Key | Contents |
|-----|----------|
| `hf-users` | `LocalUser[]` |
| `hf-households` | `Household[]` |
| `hf-invitations` | `Invitation[]` (legacy local invite cache) |
| `hf-session` | `AppSession` — `{ userId, householdId }` |
| `hf-pending-invite` | Legacy invite ID from `?invite=` URL param |
| `hf-pending-inv-token` | v2.1 raw token from `?inv=` URL param |

### Exports

```typescript
// Session
getSession(): AppSession | null
persistSession(session: AppSession): void
clearSession(): void

// Sign up / sign in
signUpEmail(email, password, name): Promise<{ user, household } | { error }>
signInEmail(email, password):       Promise<{ user, household } | { error }>
signInWithGoogle(profile):          { user, household }   // synchronous

// User CRUD
getUserById(id): LocalUser | null
upsertUserPublic(user): void

// Household CRUD
getHouseholdById(id): Household | null
upsertHouseholdPublic(household): void

// Legacy local invite cache
createInvitation(email, householdId, invitedBy): Invitation
getPendingInvites(householdId): Invitation[]
cancelInvitation(inviteId): void
acceptInvitation(inviteId, userId): { household } | { error }

// One-time migration from old hf-accounts format
migrateIfNeeded(): void
```

### Password hashing

```typescript
// SHA-256 via Web Crypto API — no external libraries
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
```

Passwords are never stored or logged as plain text. `passwordHash` is only present for `authProvider: 'email'` users; Google users have no password.

### Legacy migration

`migrateIfNeeded()` reads the old `hf-accounts` key (v1 format), creates a `LocalUser` + private `Household` for each account, copies finance data to the new key (`hf-data-{householdId}`), then removes `hf-accounts`. It is idempotent — safe to call on every boot.

---

## `src/lib/googleAuth.ts`

Google Identity Services (GIS) integration.

### Exports

```typescript
// Initialize GIS on app boot — retries every 500ms until the script loads
initGoogleAuth(onSuccess: (profile: GoogleProfile) => void): void

// Render Google's official sign-in button into a DOM element
renderGoogleButton(element: HTMLElement): void

// One-Tap prompt (fallback only)
promptGoogleSignIn(): Promise<'ok' | string>

// Check if GIS script is loaded and CLIENT_ID is set
isGoogleAvailable(): boolean

// Decode a GIS credential JWT (no signature verification — GIS handles that)
decodeGoogleJWT(credential: string): GoogleProfile
```

### `GoogleProfile` type

```typescript
interface GoogleProfile {
  sub: string             // unique Google user ID
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}
```

### Why `renderButton()` instead of `prompt()`

| Method | Browser support | Works with ad blockers |
|--------|----------------|----------------------|
| `renderButton()` | All modern browsers | Usually yes |
| `prompt()` / One-Tap | Blocked by most browsers | Often no |

The `AuthPage` polls every 200ms for `isGoogleAvailable()` (up to 6 seconds), shows a shimmer skeleton while waiting, then renders Google's official button once ready. The fallback button triggers `promptGoogleSignIn()` as a last resort.

---

## `src/context/AuthContext.tsx`

React context wiring everything together. Consumed via `useAuth()`.

### `AuthContextType`

```typescript
interface AuthContextType {
  user: LocalUser | null
  household: Household | null

  // v2.1 — token-based invite rows from household_invites table
  householdInvites: HouseholdInvite[]

  // Auth methods
  signUpEmail(email, password, name): Promise<string | null>  // null = success
  signInEmail(email, password):       Promise<string | null>
  signInWithGoogle(): void
  signOut(): void

  // Invite management (see invites.md for full details)
  createInvite(method, email?): Promise<CreatedHouseholdInvite | string>
  revokeInvite(inviteId): Promise<void>
  refreshInvites(): Promise<void>

  // Household management
  renameHousehold(name): Promise<void>
  removeMember(targetUserId): Promise<string | null>
  getMembers(): LocalUser[]
}
```

### `afterAuth()` flow

Called after every successful sign-in (email or Google):

1. Sync household + membership to Supabase cloud
2. Check `hf-pending-inv-token` → call `acceptHouseholdInvite(token)` (v2.1)
3. Check `hf-pending-invite` → call `acceptCloudInvitation(id)` (legacy)
4. If an invite was accepted: move user to shared household
5. Otherwise: set user + household from the authenticated result

### Types

```typescript
interface LocalUser {
  id: string
  name: string
  email: string
  avatar?: string              // Google profile photo URL
  authProvider: 'google' | 'email'
  householdId: string
  createdAt: string
  passwordHash?: string        // email auth only; never present for Google users
}

interface AppSession {
  userId: string
  householdId: string
}
```
