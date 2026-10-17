# Spec — v4.3: Savings account owner (member or joint)

> **Status:** Approved by the user on 2026-10-17 (filter chips + per-owner totals included; existing accounts = Joint) · October 2026 · Owner: Product
> Request (user, 2026-10-17): "In the savings section I want to assign each saving to one of the users, or to both jointly — e.g. under Eilon, under Sivan, or under Joint."

---

## Feature: Assign a savings account to a household member or to "Joint"

**Problem:**
The Savings tab lists every account in one pile. A couple usually has a mix:
- personal accounts (Eilon's pension, Sivan's study fund / קרן השתלמות)
- joint accounts (the shared checking account, the emergency fund)

Today there is no way to see whose account is whose, or how much each person has saved. People work around it by putting the name in the account title ("פנסיה – סיון").

**Users affected:**
- **Couple** (primary): two members, personal + joint accounts.
- **Freelancer / single-member household:** the owner choice is irrelevant and is hidden (see below).

### Proposed solution

**1. Account dialog (add / edit) — new "Owner / שייך ל" field**
- A segmented control (or Select when there are more than 3 options) listing:
  **Joint / משותף** · one option per household member by name (from the Income tab members, e.g. Eilon · Sivan).
- Default for a new account: **Joint** — or the member currently selected in the Savings filter.
- Shown only when the household has **2 or more members**. With 0–1 members the field is hidden and the account stays Joint.

**2. Account row — owner badge**
- Line 2 of the row gets a badge with icon + text (never colour alone):
  - member-owned: `User` icon + member name ("Eilon")
  - joint: `Users` icon + "Joint / משותף"
- Shown only when the household has 2+ members.

**3. Savings tab — owner filter + per-owner totals**
- Above the Liquid / Locked tiles: filter chips **All · Eilon · Sivan · Joint** (44px tap targets, horizontally scrollable on mobile, RTL-correct).
- Selecting a chip filters both account groups and the Liquid / Locked totals and the "Monthly contributions" line to that owner.
- "All" (default) behaves exactly as today. Filter state is React state only (not persisted, not synced).
- Chips shown only when the household has 2+ members.

**4. What does NOT change**
- Home, goal allocation, savings projection, FCF, snapshots, transfers, auto-increment and expense→account linkage all keep using **all** accounts regardless of owner. Ownership is a label + a view filter only.

### Data contract (🔴 Data Safety Protocol)

| Item | Change |
|---|---|
| `SavingsAccount` type | **Add** one optional field: `ownerMemberId?: string` — the `HouseholdMember.id` of the owner. **Absent = Joint.** Nothing removed or renamed. |
| Merge strategy | **Unchanged.** `accounts` stays additive `mergeById` (cloud wins per account id); the field travels inside the account object. No change to `cloudFinance.ts` or to FinanceContext sync/merge/push code. |
| Writes | Existing `addAccount` / `updateAccount` only. `AccountDialog` already builds the saved account as `{ ...base, … }`; it will set or delete `ownerMemberId` from the form. |
| Other writers preserve it | `transferBetweenAccounts`, `applyMonthlyContributions`, savings-expense linkage (`monthlyContribution` sync) all spread the account (`{ ...a, … }`) → field preserved. Unit tests guard each. |
| Deleted member | An `ownerMemberId` that no longer matches a member is **displayed as Joint** and counted under Joint in the filter. The stored value is not rewritten automatically (no silent data mutation); it is replaced only when the user edits and saves that account. Deleting a member never deletes or changes accounts. |
| Backward compatibility | Existing accounts have no field → Joint. Old clients ignore the field and keep it when they spread the account. |
| Item counts | `accounts.length` identical before/after setting an owner (unit test). |
| localStorage keys | None added. |
| `v4DataFreeze.test.ts` | No change needed — it does not pin `SavingsAccount` keys, and `FinanceContext.tsx` / `cloudFinance.ts` stay identical to `main`. |

**Required tests (`src/test/savingsOwner.test.tsx`):**
- `getAccountOwner(account, members)` helper → member / `'joint'`; absent → joint; ghost id → joint.
- Filter helper: All returns every account; per-member and Joint partitions together equal All (no account lost or double-counted).
- `mergeFinanceData` keeps `ownerMemberId` in empty-cloud, empty-local and diverged (A+B / B+C → A+B+C) cases; account counts never decrease.
- AccountDialog save path: setting owner, switching back to Joint removes the field, editing other fields keeps the owner.
- Transfer, auto-increment and linked-expense updates keep `ownerMemberId`.

### Acceptance criteria
- [ ] With 2+ members, the user can choose Joint / Eilon / Sivan when adding or editing a savings account.
- [ ] The row shows the owner badge with icon + text.
- [ ] Filter chips show only that owner's accounts, and the totals/contributions update accordingly; "All" equals today's numbers.
- [ ] Existing accounts appear as Joint with no user action.
- [ ] Setting an owner on one device appears on the partner's device after sync.
- [ ] Home, goals, projections and History numbers do not change.
- [ ] With a single member, nothing new is shown.
- [ ] All strings via `t(en, he, lang)`; works in Hebrew RTL, dark mode, 375px; tap targets ≥ 44px.
- [ ] `npm test` and `npm run build` pass.

### Out of scope
- Percentage splits of a joint account (e.g. 60/40).
- Owner on goals, expenses or income.
- Per-owner charts on Home.
- Linking ownership to login users (auth accounts). Owner is a finance *member* (Income tab), which is what the household already names "Eilon" / "Sivan".

### Decisions (user, 2026-10-17)
1. Filter chips + per-owner totals: **included**.
2. Existing accounts: **Joint** by default.

### Success metric
- ≥ 50% of 2-member households assign an owner to at least one account within a month.
- Fewer account names containing a member's name.
