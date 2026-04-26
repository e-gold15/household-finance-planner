# Deployment

## Hosting

The Household Finance Planner is hosted on **Vercel** and connected to the GitHub repository `e-gold15/household-finance-planner`. Every push to the `main` branch triggers an automatic production deployment. Pushes to other branches create preview deployments with unique URLs.

| Environment | URL | Trigger |
|-------------|-----|---------|
| Production | https://household-finance-planner.com | Push to `main` |
| Preview | `https://<branch>-<hash>.vercel.app` | Push to any branch |
| Local dev | http://localhost:5173 | `npm run dev` |

---

## Environment Variables

Environment variables are configured in **Vercel Dashboard → Project → Settings → Environment Variables**. For local development, copy `.env.example` to `.env.local` and fill in the values.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL — found in Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase public anon key — safe to expose in client code (RLS protects data) |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 client ID — required to enable Google Sign-In |
| `VITE_ANTHROPIC_API_KEY` | Optional | Enables AI features (receipt scan, goal plan explanation) — see `docs/_shared/ai-features.md` |

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the app runs in local-only mode: all finance and auth features work, but cloud sync, invite links, and the Members tab are disabled.

If `VITE_GOOGLE_CLIENT_ID` is missing, the Google Sign-In button is not rendered. Email auth remains available.

If `VITE_ANTHROPIC_API_KEY` is missing, the AI Explain and Scan Receipt buttons are hidden. All other features work normally.

---

## Build Process

### Build command (run by Vercel automatically)

```bash
tsc -b && vite build
```

The build runs TypeScript compilation first (`tsc -b`) and then bundles with Vite. This means TypeScript errors block the deploy — no broken TypeScript ships to production.

**Note:** Always run `npm run build` locally before pushing. The full build catches TypeScript errors that `tsc --noEmit` may miss due to Vite-specific configuration.

### Output

```
dist/
  index.html
  assets/
    index-[hash].js     # Main JS bundle
    index-[hash].css    # Compiled Tailwind CSS
```

Vercel serves the `dist/` directory as a static site. The `index.html` file is served for all routes (SPA mode).

---

## Deploy Process

Standard deploy:

```bash
git add .
git commit -m "feat(ui): add goal reordering"
git push origin main
```

Vercel picks up the push within seconds and runs:

1. `npm install` — install dependencies
2. `tsc -b && vite build` — build
3. Deploy to CDN

The deploy typically completes in 60–90 seconds. The previous production deployment stays live until the new one is healthy.

---

## Pre-push Checklist

Before pushing to `main`, always run:

```bash
npm test          # All 300 tests must pass
npm run build     # TypeScript + bundle must succeed
```

If either command fails, fix the issue before pushing. Vercel will also run `npm run build`, but catching failures locally is faster and avoids a broken production URL.

---

## One-time Database Setup

The Supabase database schema is defined in `supabase/migration.sql`. This file is not run automatically — it must be run manually in the Supabase Dashboard the first time you set up the project, and whenever schema changes are added.

### Steps

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Paste the contents of `supabase/migration.sql`
5. Click **Run**

The migration file is idempotent — all statements use `IF NOT EXISTS` or `CREATE OR REPLACE`, so it is safe to run multiple times.

### Tables created by the migration

| Table | Purpose |
|-------|---------|
| `households` | Household registry |
| `household_memberships` | Who belongs to which household |
| `household_invites` | Invite tokens (hashed) |
| `user_profiles` | Public profile data (name, email, avatar) |
| `household_finance` | Shared financial data blob (entire FinanceData JSON) |

### RPC functions created

| Function | Purpose |
|----------|---------|
| `get_household_members_with_profiles(p_household_id)` | Returns members with their profile data in a single query |

After running the migration, ensure the RPC function has execute permission for the `anon` role:

```sql
GRANT EXECUTE ON FUNCTION get_household_members_with_profiles(text) TO anon;
```

---

## Google OAuth Setup

Google Sign-In requires the live domain to be registered as an authorised origin in Google Cloud Console.

### Steps

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Select the OAuth 2.0 Client ID used for this project
4. Under **Authorised JavaScript origins**, add:
   - `https://household-finance-planner.com`
   - `http://localhost:5173` (for local development)
5. Under **Authorised redirect URIs**, no changes are needed (GIS does not use redirect URIs)
6. Click **Save**

Changes to OAuth settings can take up to 5 minutes to propagate.

**Known issue:** If Google Sign-In stops working on the live domain after a domain change, the most likely cause is that the new domain has not been added to the authorised origins list.

---

## Rollback

Vercel maintains a deployment history. To roll back to a previous deployment:

1. Open Vercel Dashboard → Project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → **Promote to Production**

This is instant — no rebuild required.

Alternatively, revert the problematic commit and push to `main`:

```bash
git revert HEAD
git push origin main
```

---

## Monitoring

Vercel provides:
- **Build logs** — visible in Vercel Dashboard → Deployments → (deployment) → Build Logs
- **Function logs** — not applicable (no serverless functions in this project)
- **Analytics** — Vercel Web Analytics (if enabled in project settings)

Supabase provides:
- **Database logs** — Supabase Dashboard → Logs → Postgres
- **API logs** — Supabase Dashboard → Logs → API
- **Usage metrics** — Supabase Dashboard → Reports

There is no application-level error monitoring (e.g. Sentry) configured at this time. Console errors in the browser are the primary signal for client-side issues.

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/e-gold15/household-finance-planner.git
cd household-finance-planner

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, and optional keys

# 4. Start the dev server
npm run dev
# → http://localhost:5173

# 5. Run tests
npm test

# 6. Build to check for TypeScript errors
npm run build
```

The dev server supports hot module replacement (HMR) — changes to React components and TypeScript files appear in the browser instantly without a full reload.
