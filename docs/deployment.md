# Deployment

---

## Production

- **URL:** https://household-finance-planner.com
- **Host:** Vercel
- **Repo:** https://github.com/e-gold15/household-finance-planner
- **Auto-deploy:** Every push to `main` triggers a Vercel deployment

---

## Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 client ID |

> Never set `VITE_SUPABASE_SERVICE_ROLE_KEY` — it would be exposed in the browser bundle.

---

## Supabase Migration

Run once per Supabase project (dev or prod):

1. Supabase Dashboard → SQL Editor → New query
2. Paste the full contents of `supabase/migration.sql`
3. Click Run
4. Expected: "Success. No rows returned"

The migration uses `create table if not exists` — safe to re-run.

---

## Google Sign-In Setup

The Google button will silently render blank if the domain isn't whitelisted in Google Cloud Console.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials → OAuth 2.0 Client IDs**
3. Click your Web client → Edit
4. **Authorized JavaScript origins** — add:
   - `https://household-finance-planner.com`
   - `https://www.household-finance-planner.com`
   - `http://localhost:5173` (for local dev)
5. Save → copy the Client ID
6. Add to Vercel env vars as `VITE_GOOGLE_CLIENT_ID`
7. Redeploy (Vercel → Deployments → Redeploy)

---

## Git & SSH

The repo uses SSH authentication (no HTTPS/PAT):

```bash
git remote -v
# origin  git@github.com:e-gold15/household-finance-planner.git

git push    # works without prompting for credentials
```

SSH key: `~/.ssh/id_ed25519` — added to GitHub → Settings → SSH and GPG keys.

---

## Manual Build

```bash
npm run build    # TypeScript check + Vite production build → dist/
npm run preview  # Serve dist/ locally at http://localhost:4173
```

`dist/` is a static site — can be hosted on any CDN (Vercel, Netlify, Cloudflare Pages).

---

## Vercel Configuration

No `vercel.json` needed for this project. Vercel auto-detects Vite and sets:
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

SPA routing (all routes → `index.html`) works automatically with Vercel's default static output config.
