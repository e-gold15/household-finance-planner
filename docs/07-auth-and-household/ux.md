# Auth & Household — UX & UI Specification

## Auth Page

The auth page is the entry point for new and returning users. It is shown whenever no valid session exists.

### Layout

- Full-page centred card, max-width 400px
- App logo and name at the top
- Google Sign-In button as the primary CTA
- Email section below Google button (collapsed by default)

### Google Sign-In Button

| Property | Detail |
|----------|--------|
| **Appearance** | Official Google-branded button rendered by `google.accounts.id.renderButton()` |
| **Width** | Full-width of the card |
| **Position** | Primary CTA — topmost interactive element |
| **Text** | "Sign in with Google" (Google controls the text for brand compliance) |

The Google button is a first-party Google UI element. It cannot be restyled with Tailwind — it is injected as an iframe by the Google Identity Services (GIS) library.

### Email Section

The email section is in an accordion that is collapsed by default. Clicking "Sign in with email" expands it.

When expanded, it shows two tabs:

| Tab | Content |
|-----|---------|
| **Sign in** | Email input + Password input + Sign In button |
| **Create account** | Name input + Email input + Password input + Create Account button |

Form validation:
- All fields are required
- Email must be a valid email format
- Password: no minimum length enforced in UI (SHA-256 accepts any length)
- Error messages appear inline below the relevant input in `text-destructive`

---

## App Header

The header is persistent across all tabs once the user is signed in.

### Header Elements

| Element | Detail |
|---------|--------|
| **App name / logo** | Left side; clicking returns to Overview tab |
| **User chip** | Right side; shows user avatar (Google photo or initials fallback) + user name |
| **Household name** | Shown below or alongside user name as a smaller label |

### User Menu

Clicking the user chip opens a dropdown menu with:

- **User name and email** (non-interactive header row)
- **Household name** (non-interactive)
- **Settings** — opens the Household Settings dialog
- **Sign out** — clears the session and returns to the auth page

The dropdown closes when clicking outside it or pressing Escape.

---

## Household Settings Dialog

Opened from the user menu. Contains two tabs: **Household** and **Members**.

### Household Tab

| Section | Content |
|---------|---------|
| **Household name** | Editable text field; Save button; only visible to owner |
| **Invite management** | Create invite section + list of pending invites |
| **Leave household** | Danger-zone button; owner cannot leave (must transfer ownership first — not yet implemented) |

#### Create Invite Section (owner only)

Two invite method options, displayed as radio buttons or a segmented toggle:

- **Email invite** — shows an email input field; on submit, creates a targeted invite
- **Shareable link** — generates a link immediately; shows copy-link button

After creation:
- Link appears in a read-only text input with a **Copy Link** button (Clipboard icon)
- A success toast confirms the link is copied

#### Pending Invites List

Each pending invite shows:

| Element | Detail |
|---------|--------|
| **Method badge** | "Email" or "Link" (`outline` badge variant) |
| **Recipient** | Email address (for email invites) or "Anyone with the link" |
| **Expiry badge** | Countdown — e.g. "Expires in 3 days" (`warning` badge if < 24h) |
| **Revoke button** | Trash icon; immediately invalidates the invite |
| **Copy button** | Clipboard icon; copies the invite URL again |

Revoke requires a single click — no confirmation dialog (revocation is low-risk and reversible via a new invite).

### Members Tab

Displays the live member list fetched from Supabase via the `get_household_members_with_profiles` RPC.

| Column | Content |
|--------|---------|
| **Avatar** | Google profile photo or initials circle (same fallback as header) |
| **Name** | Member's display name |
| **Email** | Member's email address |
| **Role badge** | "Owner" (`default` teal badge) or "Member" (`secondary` badge) |
| **Joined** | Human-readable join date — e.g. "Joined 15 Jan 2025" |

Loading state: skeleton rows shown while the RPC call is in flight.
Empty state: shown if the RPC returns an error (with a retry button).

---

## Invite Acceptance Flow

When a recipient opens an invite link:

1. The app detects the invite token in the URL query string.
2. If the user is not signed in, the auth page is shown with a banner: "You've been invited to join [Household Name]. Sign in or create an account to accept."
3. After sign-in or sign-up, the app automatically calls the invite acceptance function.
4. A success message is shown: "You've joined [Household Name]!"
5. The user lands directly on the Overview tab of the household.

If the invite is expired or revoked, an error message is shown instead: "This invite link is no longer valid. Ask the household owner for a new one."

---

## Mobile Layout

On screens narrower than 640px:

- Auth page card is full-width with `px-4` padding; no card border radius on mobile
- Google Sign-In button remains full-width
- Household Settings dialog is full-height sheet (slides up from bottom) rather than a centred modal
- Members tab: avatar and name on one row; role badge and join date on a second row (stacked)
- Pending invites: method badge and expiry on one row; copy/revoke buttons on the next row

---

## RTL (Hebrew) Support

- All margin utilities use logical properties (`me-*`, `ms-*`)
- User menu dropdown opens in the correct direction for RTL
- Role badges and expiry badges use text labels, not icon-only indicators
- The invite creation form labels align correctly in RTL

---

## Accessibility Checklist

- [ ] Google Sign-In button is keyboard-focusable (Google GIS renders it with `tabindex`)
- [ ] Email form inputs have associated `<Label>` elements
- [ ] Error messages are linked to inputs via `aria-describedby`
- [ ] Household Settings dialog has `role="dialog"`, `aria-labelledby`, and focus trapping
- [ ] Revoke button has `title="Revoke invite"` for screen readers
- [ ] Copy button has `title="Copy invite link"`
- [ ] Role badge uses text label (not icon alone) — "Owner" / "Member"
- [ ] Expiry badge uses colour AND text — never colour alone
- [ ] All interactive elements meet 44px minimum tap target
- [ ] Session expiry results in a visible sign-out notification, not a silent redirect
