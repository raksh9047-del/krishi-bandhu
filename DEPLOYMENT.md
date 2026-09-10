# KrishiBandhu — Deploy & Verification (Phase 10)

This app is a **single Next.js 14 application**: the PWA frontend and all API
routes (`app/api/**`) ship together, and the "backend" database is hosted
Supabase (Postgres + Row-Level Security). There is no separate backend
service in this repo, so both a Vercel deploy and a Railway/Render deploy
below deploy the SAME Next.js app; the difference is only where you host it.
Pick one host — you do not need both.

---

## 1. Environment variables

| Variable | Where used | Required? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server (`lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabase-admin.ts`) | yes | Public URL of your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client reads (`lib/supabase.ts`) + auth routes | yes | Public anon key — safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes only (`lib/supabase-admin.ts`) | yes | **Server-only. Never set this client-side or commit it.** Bypasses RLS. |
| `DATA_GOV_IN_API_KEY` | `lib/agmarknet.ts` | no | Real data.gov.in key for unlimited live-price syncs; falls back to the public demo key (10 records/call). |

`.env.example` holds all four variables. `.env.local` exists with placeholders —
replace them with your real values before any Supabase call works.

### Auth routes (new in Phase 10)

The app now has real phone-based OTP auth. These routes live under
`app/api/auth/` and use the **anon client** for OTP send/verify (the admin
client can't verify OTPs):

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Creates auth user + matching `users` row. `role` fixed to `farmer`/`trader`. |
| `/api/auth/login` | POST | Triggers OTP to the phone. |
| `/api/auth/verify-otp` | POST | Verifies OTP, returns session tokens. |

The client stores tokens in `localStorage` under `krishibandhu-session` and
forwards `Authorization: Bearer <token>` on every API call via
`components/auth/SessionProvider.tsx`'s `fetchWithAuth`. Server routes use
`lib/auth.ts`'s `authenticateRequest()` to validate the JWT and build a
session-scoped client (`lib/supabase-server.ts`) so RLS policies actually
apply — this is the hardening item flagged in the old `lib/supabase-admin.ts`
comment.

---

## 2. Supabase project setup (manual)

1. Create a project at https://supabase.com/dashboard.
2. **Enable Phone Auth** (Auth → Sign-in providers → Phone). The app uses
   phone-based OTP login, not email or password.
3. In the SQL Editor, run these **in order**:
   1. `supabase/schema.sql` (all tables + RLS + the auth-user sync trigger).
   2. `supabase/migrations/002_subsidy_disbursements.sql`
   3. `supabase/migrations/003_fpo_price_entries_public_read.sql`
   4. `supabase/migrations/004_bids.sql`
   5. `supabase/migrations/005_live_prices.sql`
   6. `supabase/migrations/006_backhaul_seed.sql` (backhaul trucks)
   7. `supabase/migrations/007_alerts.sql` (farmer alerts table — without this
      `lib/alerts.ts` silently falls back to Storage JSON blobs, which works
      but has no efficient filtering or cleanup. Apply it before the seed so
      alerts created during seeding land in Postgres.)
4. Seed the pilot demo dataset (subsidy history, sowing signals, seed prices,
   demo FPO user, AND demo farmer/trader auth accounts):
   ```bash
   node scripts/seed-pilot.mjs                 # prints SQL for the SQL Editor
   node scripts/seed-pilot.mjs --apply         # or apply directly (needs the env vars above)
   ```
   The `--apply` path also creates the demo auth users (phone `9876543210`
   farmer, `9876543211` farmer, `9876543220` trader) via the admin client.
5. **Storage:** create a **public** bucket named `parchi-photos`
   (Storage → New bucket → toggle Public). Required before Parchi
   quality-assessment photo uploads work. This is a dashboard step, not code.
6. **Auth sync:** the trigger at the bottom of `schema.sql` keeps `users.id`
   in sync with `auth.users.id`. Without it, RLS policies that key off
   `auth.uid()` would never match. The sign-up route (`app/api/auth/signup`)
   inserts the `users` row with the same UUID as the auth user, so the trigger
   is a backstop — it also catches users created outside the app.

---

## 3. Deploy the app

### Option A — Vercel (recommended, one command for a first deploy)

```bash
npm i -g vercel
vercel link          # link to your Vercel project (or let it create one)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATA_GOV_IN_API_KEY      # optional
vercel               # preview
vercel --prod        # production
```

Every push to the linked git remote auto-deploys. The PWA runs `next-pwa` on
build, so `/sw.js` is generated server-side at build time — no extra config.

### Option B — Railway / Render

- **Railway:** `railway init` → `railway add` a service → set the four env
  vars (same table as above, `Build Command: npm run build`,
  `Start Command: npm run start`) → `railway up`.
- **Render (Web Service):** New → Web Service → connect the repo →
  Build Command `npm run build`, Start Command `npm run start`,
  env vars as above → Deploy.

---

## 4. Scheduled jobs (already configured in `vercel.json`)

Both crons are wired in `vercel.json` and fire automatically on Vercel. On
Railway/Render, set up equivalent schedulers against the same URLs.

- **Daily live-price sync** — `POST /api/prices/sync` runs at 04:30 UTC daily.
  Pulls the Agmarknet feed into `prices` (source='live').
- **Weekly Sowing Signal recalc** — `POST /api/sowing-signal/calculate` runs
  every Sunday at 06:00 UTC. Recalculates signals for every active crop/mandi
  pair whose sowing window is open.

---

## 5. Full-system verification checklist

Status this build could honestly achieve **without a live Supabase project /
data.gov.in network** is marked `built` (verified via `next build`, type
check, lint, and code audit). Items marked `run-live` need you to finish
section 2 and click through. Nothing below claims a success the workspace
didn't produce.

| # | Check | Result |
|---|---|---|
| 0 | Sign up a new farmer → sign in with OTP → session persists across reloads | `run-live` — `/api/auth/signup`, `/api/auth/login`, `/api/auth/verify-otp` + `SessionProvider` all verified as code; needs a real Supabase project with phone auth enabled. |
| 1 | Farmer registration → Sowing Signal card shows a real state for all 3 pilot crops | `run-live` — route + thresholds + seed verified as code; needs seeded Supabase. |
| 2 | A trader creates a Parchi; the ledger shows it with a valid hash | `run-live` — hash-chain + routes audited; needs a real insert. |
| 3 | "Simulate Kharaba Fraud" runs and resets cleanly for all 3 pilot pairs, incl. live crop switch mid-demo | `run-live` — sandboxed in-memory demo; verifiable by clicking. |
| 4 | A dispute fires both escalation channels and shows the 48h countdown | `run-live` — dual-channel insert + timer audited. |
| 5 | UPI payment button/QR generates with VPA on file; correct `422` without | `built` + `run-live` — link builder & 422 path audited; QR needs a browser. |
| 6 | Mandi Heatmap recolors correctly across all 3 pilot crops | `run-live` — `/map` re-fetches on crop change; requires seeded signals. |
| 7 | Language toggle renders correctly on farmer, trader, and data/maps screens | `built` — 144 keys parity-checked across en/mr/hi. |
| 8 | Every stub (AgriStack, WhatsApp, UPI Autopay, statewide overlay dots) visibly disabled + explanatory tooltip, never fakes success | `built` — `StatusBadge` comingSoon gating + grey dots audited. |
| 9 | Corrected Net Realization transport breakdown for both arranger cases | `built` — `lib/net-realization.ts` unit-consistent; toggle paths audited. |

**One rule that never bends:** nothing fakes success. A greyed-out control
with a "Coming Soon" tooltip is honest; a button that pretends to succeed is
not.