# Local Setup

## Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project (free tier is fine)
- (Optional) A Google Cloud OAuth 2.0 client ID

## Steps

```bash
# 1. Clone
git clone git@github.com:e-gold15/household-finance-planner.git
cd household-finance-planner

# 2. Install
npm install

# 3. Environment
cp .env.local.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Database — run once in Supabase Dashboard → SQL Editor
#    Paste the full contents of supabase/migration.sql and click Run

# 5. Dev server
npm run dev   # → http://localhost:5173
```

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm test` | Run all unit tests once (Vitest) |
| `npm run test:watch` | Re-run tests on file save |
| `npm run test:coverage` | Tests + V8 coverage report |
| `npm run lint` | ESLint check |
| `npm run preview` | Serve the production build locally |

## Environment Variables

All are prefixed `VITE_` so Vite exposes them to the browser bundle.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **Yes** | Project URL — Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Anon/public key — Supabase → Settings → API |
| `VITE_GOOGLE_CLIENT_ID` | No | OAuth 2.0 client ID from Google Cloud Console |

> ⚠️ `.env.local` is gitignored. Never commit real credentials.
> Never set `VITE_SUPABASE_SERVICE_ROLE_KEY` — the service role key must never be in the browser.

Without `VITE_GOOGLE_CLIENT_ID` the Google button renders in a disabled/fallback state and email auth still works normally.
