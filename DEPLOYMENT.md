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
| `NEXT_PUBLIC_SUPABASE_URL` | client + server (`lib/supabase.ts`, `lib/supabase-admin.ts`) | yes | Public URL of your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client reads (`lib/supabase.ts`) | yes | Public anon key — safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes only (`lib/supabase-admin.ts`) | yes | **Server-only. Never set this client-side or commit it.** Bypasses RLS. |
| `DATA_GOV_IN_API_KEY` | `lib/agmarknet.ts` | no | Real data.gov.in key for unlimited live-price syncs; falls back to the public demo key (10 records/call). |

`.env.example` holds the first three. `.env.local` exists with placeholders —
replace them with your real values before any Supabase call works.

---

## 2. Supabase project setup (manual)

1. Create a project at https://supabase.com/dashboard.
2. In the SQL Editor, run these **in order**:
   1. `supabase/schema.sql` (all tables + RLS).
   2. `supabase/migrations/002_subsidy_disbursements.sql`
   3. `supabase/migrations/003_fpo_price_entries_public_read.sql`
   4. `supabase/migrations/004_bids.sql`
   5. `supabase/migrations/005_live_prices.sql`
   6. `supabase/migrations/006_backhaul_seed.sql` (backhaul trucks)
3. Seed the pilot demo dataset (subsidy history, sowing signals, seed prices,
   demo FPO user):
   ```bash
   node scripts/seed-pilot.mjs                 # prints SQL for the SQL Editor
   node scripts/seed-pilot.mjs --apply         # or apply directly (needs the env vars above)
   ```
4. **Storage:** create a **public** bucket named `parchi-photos`
   (Storage → New bucket → toggle Public). Required before Parchi
   quality-assessment photo uploads work. This is a dashboard step, not code.
5. **Auth:** the RLS policies key off `auth.uid()`, so Supabase Auth user ids
   must match `users.id`. Enable the auth provider you use and ensure
   `users.id` = the auth user id (or add a trigger to sync them). The pilot
   routes use the service-role client, so the app works before this is wired;
   it matters only for real session-based flows.

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

## 4. Optional scheduled jobs (not app code)

- **Weekly Sowing Signal recalc** — the API computes on demand; a recurring
  job hitting `/api/sowing-signal/calculate` for each active crop/mandi pair
  keeps signals fresh. On Vercel use Cron Jobs (`vercel.json` crons schema);
  on Railway/Render use their schedulers against the same URL.
- **Daily live-price sync** — call `POST /api/prices/sync` daily to pull
  the Agmarknet feed into `prices` (source='live').

---

## 5. Full-system verification checklist

Status this build could honestly achieve **without a live Supabase project /
data.gov.in network** is marked `built` (verified via `next build`, type
check, lint, and code audit). Items marked `run-live` need you to finish
section 2 and click through. Nothing below claims a success the workspace
didn't produce.

| # | Check | Result |
|---|---|---|
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