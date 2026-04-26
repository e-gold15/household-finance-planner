# Auth & Household — Product Overview

## Purpose

Every user of the Household Finance Planner belongs to a private household. Authentication and the household model together ensure that:

1. **Only authorised people can access the household's financial data.**
2. **All household members see the same data, whether they are on the same device or across different devices.**
3. **Joining a household is simple — an invitation link is all that is needed.**

---

## User Value

> "One household, one shared financial view — accessible by any member, on any device, instantly."

Couples, flatmates, and family members should be able to manage finances together without sending spreadsheets back and forth. The household model makes this seamless: everyone who joins the household automatically sees the same income, expenses, goals, and history.

---

## Authentication Methods

### 1. Google Sign-In (Primary)

The recommended sign-in method. Users click the official Google button, choose their account, and are signed in immediately — no password required.

**Benefits:**
- No password to remember or forget
- Google profile picture is shown in the app header
- Cross-device sync is automatic — signing into the same Google account on a second device restores the correct household and all financial data without any extra steps

**How it works:** Google issues a cryptographically signed token (JWT). The app decodes this token in the browser to extract the user's name, email, and profile picture. No password is ever created or stored.

---

### 2. Email + Password

For users who prefer not to use Google Sign-In. Users create an account with their email address and a password.

**Security:**
- Passwords are hashed using SHA-256 before storage — the plain text is never saved anywhere
- The hash is stored locally on the device, not transmitted to any server
- If a user forgets their password, they cannot recover it — they would need to create a new account (password reset is on the future roadmap)

---

## The Household Model

Every user belongs to exactly one household at a time. A household is the container for all financial data: income sources, expenses, savings accounts, goals, and history.

### Household roles

| Role | Permissions |
|------|-------------|
| **Owner** | Can invite new members, revoke invites, and manage the household name. The owner is the person who created the household. |
| **Member** | Can view and edit all financial data but cannot manage invitations or household settings. |

### Household data scope

All financial data is scoped to the household. This means:

- Members A and B, both in the same household, see the same expenses, goals, and history.
- If member A adds an expense on their phone, member B will see it on their laptop after the next sync (within approximately 1.5 seconds).

---

## Invite Flow

Adding a new member to a household is done through the invite system.

### Step-by-step

1. The household owner opens **Settings → Household → Invite**.
2. The owner chooses one of two invite methods:
   - **Email invite** — sends an invitation specifically targeted to one email address. Only someone who signs in with that email can accept it.
   - **Shareable link** — generates a link that anyone can use. Useful for sharing in a family group chat, for example.
3. All invites expire after **7 days**. After expiry, the link no longer works and the owner must generate a new one.
4. The recipient opens the link in any browser:
   - If they already have an account, they sign in and are automatically added to the household.
   - If they do not have an account, they complete sign-up and are automatically added to the household.
5. The recipient is now a member with the **Member** role. They immediately see all household financial data.

### Invite management

- The owner can see all pending invites in the Household Settings dialog.
- Each pending invite shows the expiry date and, for email invites, the recipient's email address.
- The owner can revoke any pending invite at any time. A revoked invite link becomes immediately invalid.

---

## Cross-Device Sync

### Google Sign-In

For users who sign in with Google, cross-device sync is fully automatic:

1. User signs in with Google on a new device.
2. The app looks up the household associated with their Google account in Supabase.
3. The household and all financial data are pulled down from the cloud.
4. The user lands directly in their household — no "welcome" banner, no manual setup required.

This means signing into Google on a new phone, tablet, or computer gives immediate access to all household data without any manual steps.

### Email accounts

Email accounts use device-local storage for auth. Cross-device sync of financial data is available (via Supabase cloud sync) but requires the same account to be set up on each device. The cross-device household recovery flow is optimised for Google users.

---

## Session Expiry

Sessions last 30 days. After 30 days, the user is automatically signed out and must sign in again. This prevents indefinite access from a device that may have been lost or shared.

---

## Out of Scope

- Password reset / forgot password (on the roadmap)
- Two-factor authentication
- Multiple household membership (a user belongs to exactly one household at a time)
- Admin panel for managing all users (this is a self-service product)
- Supabase Auth — the app uses its own local auth system; Supabase is used only for data storage, not authentication
