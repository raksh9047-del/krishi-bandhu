# KrishiBandhu — Build Status

Built here, in this sandbox, phase by phase — same 10-phase plan the Desktop
handoff (`KrishiBandhu_Handoff_To_Opencode_Phases8-10.md`) encodes, executed
directly against the unzipped Phases 1–7 reference build.

**Constraint note:** from the 2026-09-08 session onward this workspace CAN run
`npm install`, `npm run lint`, and `npm run build`. What it still can't do is
reach a live Supabase project or the data.gov.in feed (no credentials /
network), so every database-backed flow is verified by build + type check +
code audit here, and the DB apply steps (migrations + seed + the Phase 10
checklist) are documented for you to run against your project.

## Status

- [x] Phase 1 — Foundation
- [x] Phase 2 — Database schema
- [x] Phase 3 — Trust engine & Parchi API routes
- [x] Phase 4 — Sowing Signal API
- [x] Phase 5 — Payments & disputes API
- [x] Phase 6 — Farmer app
- [x] Phase 7 — Trader app
- [x] Phase 8 — Data, maps & government layer
- [x] Phase 9 — Marathi & Hindi translations
- [x] Phase 10 — Deploy & verification (this delivery)

## What's in Phase 1

- Next.js 14 App Router + Tailwind + PWA scaffold (`next.config.js`,
  `tailwind.config.ts`, `public/manifest.json`)
- `types/index.ts` — every shared type later phases import
- `constants.ts` — the 13 crops / 10 mandis, keyed by stable id, plus the
  3x3 pilot subset and per-crop Sowing Signal thresholds
- `store/useAppStore.ts` — the crop/mandi/language Zustand store, persisted
- `components/StatusBadge.tsx`, `components/ContextSwitcher.tsx` — shared UI
  every later phase reuses
- `lib/supabase.ts` — Supabase client (typed `Database` import added once
  Phase 2's schema exists)

## What's in Phase 2

- `supabase/schema.sql` — every table (`users`, `crops`, `mandis`,
  `parchi_ledger`, `sowing_signals`, `fpo_price_entries`,
  `fpo_survey_responses`, `disputes`, `storage_directory`,
  `backhaul_trucks`), all check constraints, indexes on every
  crop_id/mandi_id column, the 13 crops + 10 mandis pre-seeded so they match
  `constants.ts` exactly, and Row-Level Security policies for every role.

### Apply it

1. Open your Supabase project → SQL Editor.
2. Paste the full contents of `supabase/schema.sql` and run it.
3. Enable email/phone auth (or your preferred provider) in Supabase Auth —
   the RLS policies key off `auth.uid()`, so `users.id` should match the
   Supabase Auth user id (either use Supabase Auth's own uuid as `users.id`,
   or add a trigger to keep them in sync).
4. Generate typed definitions and wire them into the client from Phase 1:
   ```bash
   npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
   ```
   Then in `lib/supabase.ts`, import `Database` from `types/supabase.ts` and
   change `createClient(...)` to `createClient<Database>(...)`.

## What's in Phase 3

- `lib/parchi-crypto.ts` — pure, I/O-free hash-chain functions:
  `generateParchiHash`, `verifyChainIntegrity`, `generateGenesisAnchor`.
  Phase 7's tamper demo calls these directly against an in-memory array.
- `app/api/parchi/create/route.ts` — validates and inserts a Parchi, chaining
  its hash to the farmer/mandi's latest entry (or anchoring a genesis record).
- `app/api/parchi/verify/route.ts` — runs `verifyChainIntegrity` against a
  farmer/mandi's full ledger.
- `app/api/parchi/demo-tamper/route.ts` — **demo-only**, never touches the
  real table; mutates an in-memory chain and returns the break.
- `app/api/parchi/anomaly-check/route.ts` — z-score flag on a trader's
  deduction %, flags only, never blocks a submission.

Added `zod` to `package.json` for field-level request validation — run
`npm install` again after pulling this update.

## What's in Phase 4

- `supabase/migrations/002_subsidy_disbursements.sql` — **a table the
  original spec referenced but never actually defined.** The Sowing Signal
  logic needs somewhere to read "seed-subsidy disbursement history" from,
  and Phase 2's schema never included it. Run this migration after
  `schema.sql`.
- `app/api/sowing-signal/calculate/route.ts` — blends subsidy data with FPO
  survey data into a Green/Yellow/Red signal, per-crop thresholds from
  `constants.ts`, with a real sowing-window check (404 if no window is
  configured yet, 409 if called outside the active window).

**Two honest simplifications, flagged in code comments where they live:**
1. Subsidy data is matched by the mandi's **district** — clean, since
   `mandis.district` already exists.
2. Survey data (`fpo_survey_responses`) only records a **village name**, not
   a mandi/district — there's no village→district mapping in the pilot
   schema. For now the survey side of the blend aggregates at the **crop
   level statewide**, not scoped to the mandi's district. If you want
   district-scoped survey blending, add a `district` column to
   `fpo_survey_responses` (or a village→district lookup table) before the
   demo.

Also: the spec calls for weekly recalculation during each crop's active
sowing window. This route computes on-demand when called — wiring up a
weekly Vercel Cron (or Supabase scheduled Edge Function) to hit it for every
active crop/mandi pair is a Phase 10 deployment step, not app code.

## What's in Phase 5

- `app/api/upi/generate-link/route.ts` — builds the NPCI-spec `upi://pay`
  deep link from a Parchi's farmer VPA and total amount; `422` if the farmer
  has no VPA on file.
- `app/api/disputes/create/route.ts` — fires both escalation channels
  (APMC + Kisan Call Centre) simultaneously and starts the 48h timer.

**This is the last backend-only phase.** Self-check against every API route
built across Phases 2–5, all consistent with `types/index.ts`:

| Route | Method |
|---|---|
| `/api/parchi/create` | POST |
| `/api/parchi/verify` | GET |
| `/api/parchi/demo-tamper` | POST (sandboxed) |
| `/api/parchi/anomaly-check` | GET |
| `/api/sowing-signal/calculate` | POST |
| `/api/upi/generate-link` | POST |
| `/api/disputes/create` | POST |

Phases 6–8 are UI from here on, calling these routes directly — none of them
redefine a contract.

## What's in Phase 6

Screens: `/` (Sowing Signal + Net Realization), `/register`, `/feed`
(offline-first interaction feed with a queued "record a sale" quick entry),
`/storage` (cold storage directory), `/backhaul` (return trucks) — tied
together with a `BottomNav` (not in the original spec, but needed for the
screens to form a navigable app). Plus `i18n/en.json` (fully populated),
`mr.json`/`hi.json` (scaffolded with English placeholders — real
translations land in Phase 9), and `lib/i18n.ts`'s `useTranslation()` hook.

**Three real bugs this phase surfaced and fixed, not just UI gaps:**

1. **No server/anon client split.** Every API route from Phases 3–5 was
   using the public anon Supabase client. In a real deployment, RLS would
   silently block every one of those writes (no forwarded user session =
   no `auth.uid()` match). Added `lib/supabase-admin.ts` (service-role,
   server-only) and migrated all six existing routes to it. Authorization
   on these routes is now enforced by request validation, not RLS — a
   noted Phase 10 hardening item if you want real session-based auth.
2. **`fpo_price_entries` RLS was wrong.** It only allowed an FPO to read its
   own entries, but the farmer app (and later the trader dashboard, heatmap,
   and gov dashboard) all need to read these prices. Fixed in
   `supabase/migrations/003_fpo_price_entries_public_read.sql`.
3. **`users` had RLS enabled with no INSERT policy at all**, so the direct
   client-side registration insert I first wrote would have been silently
   rejected. Added `app/api/users/register/route.ts` — validated
   server-side, `role` fixed to `'farmer'` server-side so the endpoint can't
   be used to mint other roles.

Run the new migration (003) after 001/002. `constants.ts`'s
`SOWING_SIGNAL_THRESHOLDS`/etc. from Phase 1 are unchanged and reused as-is.

## What's in Phase 7

Screens under `/trader`: dashboard (mock lot discovery + live bidding),
Parchi entry, the signature ledger + tamper demo, quality assessment,
dispute escalation (with a live 48h countdown), and UPI payment (deep link +
QR fallback). A minimal `TraderIdentity` component mirrors the farmer app's
pilot-scale registration stand-in.

Added `supabase/migrations/004_bids.sql` — another table the spec assumed
but never defined (live bidding needs somewhere to persist bids even though
the lots themselves are pilot-mocked).

**Two more instances of the same read/write gap found this phase, fixed the
same way:**
1. `parchi_ledger` has no UPDATE policy at all — the quality-assessment
   photo/grade save would have silently failed. Added
   `app/api/parchi/update-quality/route.ts` (admin client, handles the
   Storage upload too).
2. Direct owner-scoped reads (trader's ledger view, farmer's feed) hit the
   exact same "no forwarded session" wall as the writes did. Added one
   shared `GET /api/parchi/list` route and pointed **both** the new ledger
   view and the Phase 6 feed at it — the feed's Parchi-confirmation fetch
   was quietly broken since Phase 6 and would have shown an empty list
   forever. `NetRealizationCalculator.tsx` and the feed's price/transport
   logic were not touched.

**One manual step this phase needs:** create a **public** Storage bucket
named `parchi-photos` in your Supabase project (Storage → New bucket →
toggle Public) before quality-assessment photo uploads will work.

## What's in the Phases 1–7 integration set

Three features from the Python reference were ported into this Next app —
live prices, corrected transport handling, and net realization — all served
by one shared engine and two new route groups:

1. **Net realization (corrected transport rule).**
   `lib/net-realization.ts` is the single source of truth (The naive model
   always deducted transport from the payout; the corrected rule only
   deducts it when the TRADER arranged pickup — when the farmer arranges
   their own transport it shows as a separate own-expense line). The
   `POST /api/net-realization/calculate` route exposes the same function
   (zod-validated), and `NetRealizationCalculator.tsx` bundles the function
   directly so the screen still works offline.

2. **Live price dashboard.**
   `lib/agmarknet.ts` is a server-only Agmarknet client (data.gov.in):
   `fetchAgmarknetRecords` with retry, `syncLivePrices` upserting the 3x3
   pilot subset into a new `prices` table (source='live'), and
   `getCurrentPrice` preferring live over FPO/seed, then most-recent-date.
   Routes: `POST /api/prices/sync` (manual daily trigger; phase-10 cron) and
   `GET /api/prices/:crop_id/:mandi_id`. New `components/farmer/LivePriceDashboard.tsx`
   is wired into `/` and shows the price with a provenance label
   ("Agmarknet live release" vs "FPO entry, updated Xh ago") and the
   "published daily, not real-time" note.

3. **Transportation UX.**
   `NetRealizationCalculator` now has a "Who's arranging transport?" toggle
   (farmer vs trader) and renders an itemized breakdown: gross, deduction,
   transport (only when trader-arranged), net payout, own transport + net
   effective take-home (only when farmer-arranged). Price read is
   API-first with the direct `fpo_price_entries` read as fallback, so it
   degrades gracefully before migration 005 is applied or offline.

### New migration (apply after migrations 001–004)

- `supabase/migrations/005_live_prices.sql` — `prices` table with a
  unique `(crop_id, mandi_id, date, source)` index (idempotent re-syncs),
  public read RLS for authenticated roles; writes only via the admin client.

### New env var

`DATA_GOV_IN_API_KEY` — optional; falls back to the public demo key from the
data.gov.in docs (capped at 10 records/call).

## To run this yourself right now

```bash
npm install          # already done in the workspace
npm run dev          # .env.local exists with placeholders — fill in real
                     # Supabase values from your project dashboard first
```

Resolved since the note above: the two PWA icons (`public/icon-192.png`,
`public/icon-512.png`) now exist — generated once for the earlier Phase 1
build and carried over.

## Session record — 2026-09-07 (Freebuff): workspace assembly + integration hardening

State when this session stopped: **build passes, lint is clean, all 15 API
routes + 11 pages compile**. Nothing in this session changed any contract;
it made the reference build real and hardened the integration set.

### What landed

1. **Reference Phases 1–7 build is now the actual workspace.** The
   zip's project (Next 14.2 + Tailwind 3 + PWA) was copied in, deps
   installed, and it compiles for the first time — the original sandbox
   could never run `npm install`/`next build`. Compile fixes were minimal:
   a union-narrowing bug in `InteractionFeed.tsx` (explicit
   `parchi_confirmation` guard), and `_archive` excluded from `tsconfig`.
2. **Earlier Phase 1 (Next 16 / `src/` layout) preserved, not deleted** —
   moved to `_archive/phase1-next16/` (git-ignored, excluded from builds).
   Its verified PWA setup and generated icons were carried into this build
   (icons renamed to the manifest's `icon-192.png` / `icon-512.png`).
3. **`.env.local` created with clearly-labeled placeholders** (Supabase URL
   / anon key / service role key + optional `DATA_GOV_IN_API_KEY`) so the
   production build's page-data collection succeeds. `.env` untouched.
   **Replace the placeholders before any Supabase call works.**

### Hardening applied to the integration set (no contract changes)

- `LivePriceDashboard.tsx`: the Retry button now actually refetches
  (a bare `setState(loading)` never re-ran the effect). Refetch is driven
  by a `refreshTick` in the effect's dependency list.
- `lib/agmarknet.ts`:
  - Mandi aliases are now ordered candidate lists (Vashi: "Vashi"/
    "New Mumbai"/"Navi Mumbai"; Lasalgaon: "Lasalgaon"/"Lasalgoan";
    Pune Gultekdi: "Pune"/"Pune (Gultekdi)") — one wrong name no longer
    silently yields zero live data.
  - Every returned record is verified against the expected market name
    before attribution, so a fuzzy server-side filter can never file
    another market's price under the wrong `mandi_id`.
  - `getCurrentPrice` now falls back server-side to the latest
    `fpo_price_entries` row (source='fpo') per the integration spec, and
    coerces Postgres numerics so `.toFixed()` consumers can't crash.

### New migration (apply after 005)

- `supabase/migrations/006_backhaul_seed.sql` — 2–3 realistic return
  trucks per pilot mandi only (Vashi / Lasalgaon / Pune Gultekdi), so
  `/backhaul` shows real data instead of its (honest) empty state.

### Verification done at stop

- `npm run build` — ✓ compiles, service worker generated, 15 API routes.
- `npm run lint` — ✓ no warnings or errors.
- NOT yet done (needs real credentials): running migrations against a
  live Supabase project, a real `POST /api/prices/sync` against the
  data.gov.in feed, and clicking through the screens.

### What the user supplies next

The user drives phases one at a time. They will provide the path for the
Phase 2 prompt (and reference material) next; Phases 8–10 (handoff doc on
the Desktop) remain, minus what's already integrated here (live prices,
transport rule, net realization, backhaul seed).

## What's in Phase 8 — Data, maps & government layer

New stack: `react-leaflet` + OSM tiles (already in `package.json`, no key) and
Recharts.

**API routes (all zod-validated, writes via the admin client):**

| Route | Purpose |
|---|---|
| `GET /api/fpo/demo-user` | Resolves the seeded demo FPO (uuid-pinned, phone `6000000000`) so FPO screens have an identity. |
| `POST /api/fpo/price-entry` | FPO manual price + arrival entry. |
| `GET /api/fpo/price-entries` | 30-day history for the FPO dashboard. |
| `POST /api/fpo/survey` | Survey response (village, crop, area, harvest month, optional name). |
| `GET /api/fpo/survey-stats` | Current-season vs historical planting shares per crop. |
| `GET/POST /api/fpo/backhaul` + `DELETE /api/fpo/backhaul/[id]` | Backhaul truck list and admin CRUD. |
| `GET /api/v1/heatmap` | One fetch powering the map: per-pilot-mandi signal + best price + provenance, resolved server-side. |
| `GET /api/gov/analytics` | 30-day price trend per crop, dispute stats (incl. avg resolution hours), trader avg deduction % — all summed over whatever rows exist. |

**Components / screens:**

- `scripts/seed-pilot.mjs` — deterministic 3x3 seed generator: 387 subsidy
  rows (42 months back → current, ±20% variance, ~140% prev-month + sized
  current-month spikes → onion RED / tomato YELLOW / cotton GREEN), 9
  `sowing_signals` with real current-season windows (so the API no longer
  404s), 27 seed `prices` in the documented ranges. Prints SQL or `--apply`s
  via service role. (Backhaul trucks were moved OUT of this script — they
  live once in migration 006 so farmer view and FPO admin read the same rows.)
- `components/fpo/FpoIdentity.tsx` — pilot identity gate for the FPO screens.
- `components/fpo/FpoPriceEntry.tsx` — crop/mandi select, price+arrival form,
  last-used-mandi in localStorage keyed by FPO id, 30-day history + CSV export.
- `components/fpo/FpoSurvey.tsx` — the survey form + current-vs-historical
  aggregation table.
- `components/fpo/FpoBackhaulAdmin.tsx` — add/edit/delete trucks, same
  `available_capacity_kg >= 0` validation as the schema.
- `components/MandiHeatmap.tsx` (client-only, mounted via `next/dynamic
  {ssr:false}` on `/map`) — OSM tiles; pilot mandis colored by Sowing Signal
  for the selected crop (re-fetches on crop change, grey when no signal);
  the 7 non-pilot live mandis as covered markers; ~70 seeded-jitter APMC
  grey dots with honest "Not yet covered — Phase 2" popups; legend.
- `components/government/GovAnalytics.tsx` — Recharts line chart (one series
  per crop present), dispute stat cards, trader deduction table.
- `components/WhatsAppStub.tsx` — coming-soon banner + disabled input on
  `/feed` (StatusBadge, never fakes success).
- `components/DataHub.tsx` + `/data` — hub listing, and a "Data" tab added to
  `BottomNav` (now 7 tabs). `/map`, `/government`, `/fpo/prices`,
  `/fpo/survey`, `/fpo/backhaul` pages all live.

## What's in Phase 9 — Marathi & Hindi translations

`i18n/en.json`, `i18n/mr.json`, `i18n/hi.json` now carry **real, natural
Marathi and Hindi** for every one of the 144 keys across all namespaces
(verified programmatically — key parity check passes 3/3). The `useTranslation`
hook keeps its en-fallback rule, but there are now no missing keys left to
fall back on.

## Phase 10 — Deploy & verification

- `DEPLOYMENT.md` at the repo root: exact commands, full env var list
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` server-only, optional `DATA_GOV_IN_API_KEY`),
  the public `parchi-photos` Storage bucket step, migration + seed run order,
  and the honesty checklist with per-item results.
- The checklist cannot be clicked through in this workspace (no live Supabase
  project / no data.gov.in network). Every item is verified at build/type/
  code-audit level here and marked "verify on live backend" for the DB-backed
  ones — nothing reports a success it didn't produce.

## CHECKPOINT — saved state to resume from (2026-09-08)

User: "save ur state i will continue later when i command start — start from
the supabase state."

All 10 phases are COMPLETE in code. Lint clean, build green. The ONLY pending
work is the live-DB steps, which are BLOCKED on real credentials — none exist
in this workspace yet:

| Value | Current state |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | placeholder `https://YOUR-PROJECT-REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | placeholder |
| `.env` `DATABASE_URL` | 15-char placeholder |
| `supabase` CLI / `psql` | not installed |
| Sandbox network | resolves, but target host is the placeholder |

### Resume with the command "start" — do this when credentials arrive

1. Fill `.env.local` with the real `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (user pastes
   or writes them; never commit).
2. Run migrations in order. Preferred: Supabase CLI
   (`npx supabase@latest login`, `npx supabase@latest link`, `db push`) or
   apply `supabase/schema.sql` then migrations `002..006` in the SQL Editor:
   1. `supabase/schema.sql` (tables + RLS)
   2. `supabase/migrations/002_subsidy_disbursements.sql`
   3. `supabase/migrations/003_fpo_price_entries_public_read.sql`
   4. `supabase/migrations/004_bids.sql`
   5. `supabase/migrations/005_live_prices.sql`
   6. `supabase/migrations/006_backhaul_seed.sql`
3. Seed pilot data:
   ```bash
   node scripts/seed-pilot.mjs --apply   # 387 subsidy + 9 signals + 27 prices + demo FPO
   ```
4. Create the **public** Storage bucket `parchi-photos` (dashboard step).
5. Run the 9-item verification checklist in `DEPLOYMENT.md` §5 and report per
   item honestly (mark `run-live` items verified only if they actually pass).

If instead the user supplies a Supabase Management access token or a Postgres
connection string, use that route (Management API / `--db-url` psql) and
record which route was used above.

**Verified at stop:** `npm run lint` clean; `npm run build` succeeds
(Next 14.2.35, 26 API routes + 16 pages compiled, SW generated). Two type
errors found and fixed during build: the heatmap route's `crop_id` narrowing
(`getCropById` guard didn't narrow a nullable search-param `cropId`) and the
`/map` dynamic import (named export needed a `.then(m => m.MandiHeatmap)`).

**What landed this session:** all of Phase 8 (parts 1–8 + DataHub + nav),
Phase 9 (real tr/MR/HI translation of all 144 keys), Phase 10 (deploy doc +
checklist). Seed script de-duplicated against migration 006 (backhaul rows
now come from the migration only).
