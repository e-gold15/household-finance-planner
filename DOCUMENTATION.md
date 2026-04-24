# Developer Documentation — Household Finance Planner

> This is the index. Each topic has its own file in the `docs/` folder.
> For product decisions and UX specs, see `PRODUCT_DESIGN.md`.
> For a quick project overview, see `README.md`.

---

## docs/

| File | What's inside |
|------|--------------|
| [setup.md](docs/setup.md) | Local setup, environment variables, npm scripts |
| [architecture.md](docs/architecture.md) | Project structure, data flow diagram, key design decisions |
| [auth.md](docs/auth.md) | Local auth (SHA-256), Google GIS, `AuthContext` API |
| [invites.md](docs/invites.md) | Household model, invite system (v1 + v2.1), token security, UI |
| [finance.md](docs/finance.md) | `FinanceContext` API, `FinanceData` shape, data persistence |
| [tax-engine.md](docs/tax-engine.md) | Israeli + foreign tax engine API and calculation chain |
| [savings-engine.md](docs/savings-engine.md) | Goal allocation algorithm, status definitions, edge cases |
| [utils.md](docs/utils.md) | `cn`, `t`, `formatCurrency`, `generateId`, `monthsUntil` |
| [database.md](docs/database.md) | All Supabase tables, RLS policy, localStorage keys |
| [testing.md](docs/testing.md) | Test files, setup mocks, how to write tests, 95-test baseline |
| [adding-features.md](docs/adding-features.md) | Patterns for new finance fields, tabs, auth methods, i18n strings, components |
| [deployment.md](docs/deployment.md) | Vercel, Supabase migration, Google OAuth whitelisting, SSH |
| [known-issues.md](docs/known-issues.md) | Current limitations and planned fixes |

---

## Quick Reference

```bash
npm run dev          # start dev server → http://localhost:5173
npm test             # run all 95 unit tests
npx tsc --noEmit     # TypeScript check — must be zero errors before commit
git push             # auto-deploys to https://household-finance-planner.com
```

**Live app:** https://household-finance-planner.com
**Repo:** https://github.com/e-gold15/household-finance-planner

---

*Documentation version: 2.0 — April 2026*
