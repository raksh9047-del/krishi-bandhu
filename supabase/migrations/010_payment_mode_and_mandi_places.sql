-- 010_payment_mode_and_mandi_places.sql
-- KrishiBandhu — payment-mode-agnostic Parchi + Places-seeded mandi directory.
--
-- Part A: payment mode on the Parchi ledger.
--   The research finding is that forcing a digital payment rail breaks the
--   informal-credit loop between farmer and trader, so the Parchi must record
--   a sale identically regardless of how money moved. `payment_mode` is a
--   first-class, hash-protected column: cash / upi / bank_transfer / credit
--   (the trader is also the farmer's lender — recorded as a ledger note, not
--   a payment). Verification is agnostic to it only because it is hashed in.
--
-- Part B: user-submitted mandi directory.
--   Nominatim (OpenStreetMap) returns real APMCs, private mandis and even
--   individual wholesale traders, but coverage is inconsistent — it captures
--   markets someone bothered to add, not every roadside deal. So the directory
--   is seeded from the geocoder (see lib/nominatim.ts) and farmers/users can
--   submit missing ones in-app. `mandi_submissions` holds those; an admin
--   approves. A submitted mandi is NEVER shown as live data until approved, so
--   the UI can never present crowd-sourced data as verified.

-- ── Part A: payment mode ────────────────────────────────────────────────────
alter table parchi_ledger add column if not exists payment_mode text not null default 'cash';
alter table parchi_ledger add column if not exists payment_reference text;
alter table parchi_ledger add column if not exists credit_note text;

-- A Parchi is only valid when payment_mode is one of the supported rails.
alter table parchi_ledger drop constraint if exists parchi_payment_mode_check;
alter table parchi_ledger add constraint parchi_payment_mode_check check (
  payment_mode in ('cash', 'upi', 'bank_transfer', 'credit')
);

-- ── Part B: user-submitted mandi directory ──────────────────────────────────
create table if not exists mandi_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references users(id) on delete set null,
  name text not null,
  district text not null,
  lat numeric not null,
  lng numeric not null,
  market_type text not null default 'market' check (
    market_type in ('apmc', 'private_mandi', 'farmers_market', 'wholesaler')
  ),
  contact_number text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_mandi_submissions_status on mandi_submissions (status);
create index if not exists idx_mandi_submissions_district on mandi_submissions (district);

alter table mandi_submissions enable row level security;

-- Submitters see their own; admins see all.
drop policy if exists "mandi_submissions_select_own" on mandi_submissions;
create policy "mandi_submissions_select_own" on mandi_submissions
  for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists "mandi_submissions_insert_own" on mandi_submissions;
create policy "mandi_submissions_insert_own" on mandi_submissions
  for insert to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists "mandi_submissions_admin_all" on mandi_submissions;
create policy "mandi_submissions_admin_all" on mandi_submissions
  for select to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "mandi_submissions_admin_update" on mandi_submissions;
create policy "mandi_submissions_admin_update" on mandi_submissions
  for update to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- ── Part C: livestock / dairy crop categories ────────────────────────────────
-- The pilot is crop-only; this migration adds the reference rows so expanding
-- to large animals / dairy is a data change, not a rebuild. `category` is a
-- free-form column (not an enum) so it can hold 'livestock' / 'dairy' /
-- 'poultry' / 'fishery' without a schema migration per new category.
alter table crops add column if not exists category text default 'crop';
alter table crops add column if not exists unit text default 'quintal';

-- Livestock / dairy reference rows (non-breaking: they are opt-in categories
-- that the UI surfaces only when selectedCropId matches one of these ids).
insert into crops (id, name, name_mr, name_hi, category, unit) values
  ('milk', 'Milk', 'दूध', 'दूध', 'dairy', 'liter'),
  ('buffalo_milk', 'Buffalo Milk', 'बैलाचे दूध', 'भैंस का दूध', 'dairy', 'liter'),
  ('cow', 'Cattle (Cows)', 'गाय', 'गाय', 'livestock', 'head'),
  ('buffalo', 'Buffalo', 'बैल', 'भैंस', 'livestock', 'head'),
  ('goat', 'Goat', 'बकडी', 'बकरी', 'livestock', 'head'),
  ('sheep', 'Sheep', 'भेंड', 'भेड़', 'livestock', 'head'),
  ('poultry', 'Poultry (Broiler)', 'बाग', 'मुर्गी', 'poultry', 'bird'),
  ('fish', 'Fish', 'मासे', 'मछली', 'fishery', 'kg')
on conflict (id) do nothing;