-- KrishiBandhu — Phase 2: Database Schema
-- Run this in the Supabase SQL editor (or `supabase db push` with this as a
-- migration). Every table gets: uuid primary key, created_at, FKs with
-- `on delete restrict` (a Parchi or ledger row is never silently cascade-
-- deleted), and an index on every crop_id/mandi_id column since the whole
-- app filters by them.
--
-- IDEMPOTENT: every statement is safe to re-run against an existing
-- installation (the CLI's `db push` re-applies migrations when the history
-- table is empty or out of sync).

-- ─────────────────────────── Enums ───────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('farmer', 'trader', 'fpo', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'sowing_signal_status') then
    create type sowing_signal_status as enum ('green', 'yellow', 'red');
  end if;
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type dispute_status as enum ('open', 'escalated', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'facility_type') then
    create type facility_type as enum ('cold_storage', 'fpo_warehouse');
  end if;
end $$;

-- ─────────────────────────── users ───────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  name text not null,
  phone text not null unique,
  village text, -- nullable: farmer's village / trader's town
  upi_vpa text, -- nullable: traders/FPOs may not need one; farmers can add later
  created_at timestamptz not null default now()
);

-- Self-issued OTP fallback (used when no SMS provider is configured).
create table if not exists login_otps (
  phone text primary key,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table login_otps enable row level security;

-- ─────────────────────────── crops / mandis (reference tables) ───────────────────────────
-- id is a human-readable slug (text), not a uuid, so seed data and app code
-- (constants.ts) stay readable and match exactly.
create table if not exists crops (
  id text primary key, -- e.g. 'onion'
  name text not null,
  name_mr text,
  name_hi text
);

create table if not exists mandis (
  id text primary key, -- e.g. 'lasalgaon'
  name text not null,
  district text not null,
  lat numeric not null,
  lng numeric not null
);

-- Seed the 13 crops / 10 mandis (matches constants.ts exactly). Idempotent
-- via primary-key conflict.
insert into crops (id, name, name_mr, name_hi) values
  ('onion', 'Onion', 'कांदा', 'प्याज़'),
  ('tomato', 'Tomato', 'टोमॅटो', 'टमाटर'),
  ('potato', 'Potato', 'बटाटा', 'आलू'),
  ('cotton', 'Cotton', 'कापूस', 'कपास'),
  ('soybean', 'Soybean', 'सोयाबीन', 'सोयाबीन'),
  ('sugarcane', 'Sugarcane', 'ऊस', 'गन्ना'),
  ('jowar', 'Jowar', 'ज्वारी', 'ज्वार'),
  ('tur', 'Tur', 'तूर', 'तूर'),
  ('banana', 'Banana', 'केळी', 'केला'),
  ('orange', 'Orange', 'संत्री', 'संतरा'),
  ('pomegranate', 'Pomegranate', 'डाळिंब', 'अनार'),
  ('turmeric', 'Turmeric', 'हळद', 'हल्दी'),
  ('grapes', 'Grapes', 'द्राक्षे', 'अंगूर')
on conflict (id) do nothing;

insert into mandis (id, name, district, lat, lng) values
  ('vashi', 'Vashi', 'Thane', 19.07, 73.00),
  ('lasalgaon', 'Lasalgaon', 'Nashik', 20.15, 74.24),
  ('pimpalgaon-baswant', 'Pimpalgaon Baswant', 'Nashik', 20.17, 73.98),
  ('pune-gultekdi', 'Pune Gultekdi', 'Pune', 18.48, 73.87),
  ('nagpur-kalamna', 'Nagpur Kalamna', 'Nagpur', 21.17, 79.05),
  ('amravati', 'Amravati', 'Amravati', 20.93, 77.75),
  ('jalgaon', 'Jalgaon', 'Jalgaon', 21.00, 75.57),
  ('solapur', 'Solapur', 'Solapur', 17.66, 75.91),
  ('sangli', 'Sangli', 'Sangli', 16.85, 74.57),
  ('kolhapur', 'Kolhapur', 'Kolhapur', 16.70, 74.24)
on conflict (id) do nothing;

-- ─────────────────────────── parchi_ledger ───────────────────────────
create table if not exists parchi_ledger (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references users(id) on delete restrict,
  trader_id uuid not null references users(id) on delete restrict,
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  gross_weight numeric not null check (gross_weight > 0),
  deduction_percent numeric not null check (deduction_percent between 0 and 100),
  net_weight numeric not null, -- computed at insert time: gross_weight * (1 - deduction_percent/100)
  price_per_quintal numeric not null check (price_per_quintal > 0),
  total_amount numeric not null, -- computed at insert time: (net_weight/100) * price_per_quintal
  photo_url text,
  quality_grade text,
  assayer_override_grade text,
  quality_hash text, -- tamper-evident Quality Passport hash (lib/quality-crypto.ts)
  "timestamp" timestamptz not null default now(),
  previous_hash text, -- null only when is_genesis = true
  current_hash text not null unique,
  is_genesis boolean not null default false
);

-- The lookup for "latest hash in this farmer/mandi chain" — hit on every create.
create index if not exists idx_parchi_farmer_mandi_ts on parchi_ledger (farmer_id, mandi_id, "timestamp");
create index if not exists idx_parchi_crop on parchi_ledger (crop_id);
create index if not exists idx_parchi_mandi on parchi_ledger (mandi_id);
create index if not exists idx_parchi_trader on parchi_ledger (trader_id);

-- ─────────────────────────── sowing_signals ───────────────────────────
create table if not exists sowing_signals (
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  signal_status sowing_signal_status not null,
  reasoning_text text not null,
  updated_at timestamptz not null default now(),
  recalculated_at timestamptz not null default now(),
  sowing_window_start date not null,
  sowing_window_end date not null,
  primary key (crop_id, mandi_id)
);

-- ─────────────────────────── fpo_price_entries ───────────────────────────
create table if not exists fpo_price_entries (
  id uuid primary key default gen_random_uuid(),
  fpo_id uuid not null references users(id) on delete restrict,
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  price_per_quintal numeric not null check (price_per_quintal > 0),
  arrival_volume_tons numeric not null check (arrival_volume_tons >= 0),
  entered_at timestamptz not null default now()
);

create index if not exists idx_fpo_price_crop_mandi on fpo_price_entries (crop_id, mandi_id);
create index if not exists idx_fpo_price_entered_at on fpo_price_entries (entered_at);

-- ─────────────────────────── fpo_survey_responses ───────────────────────────
create table if not exists fpo_survey_responses (
  id uuid primary key default gen_random_uuid(),
  fpo_id uuid not null references users(id) on delete restrict,
  village text not null,
  crop_id text not null references crops(id) on delete restrict,
  area_hectares numeric not null check (area_hectares > 0),
  expected_harvest_month date not null,
  farmer_name text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_survey_crop on fpo_survey_responses (crop_id);

-- ─────────────────────────── disputes ───────────────────────────
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  parchi_id uuid not null references parchi_ledger(id) on delete restrict,
  raised_by uuid not null references users(id) on delete restrict,
  reason text not null check (char_length(reason) >= 10),
  status dispute_status not null default 'open',
  escalated_to_apmc boolean not null default false,
  escalated_to_kisan_call_centre boolean not null default false,
  escalation_timer_started_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_disputes_parchi on disputes (parchi_id);

-- ─────────────────────────── storage_directory ───────────────────────────
create table if not exists storage_directory (
  id uuid primary key default gen_random_uuid(),
  district text not null,
  facility_name text not null,
  facility_type facility_type not null,
  approx_capacity_tons numeric not null,
  contact_number text not null
);

create index if not exists idx_storage_district on storage_directory (district);

-- ─────────────────────────── backhaul_trucks ───────────────────────────
create table if not exists backhaul_trucks (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null,
  from_mandi_id text not null references mandis(id) on delete restrict,
  to_village text not null,
  departure_time timestamptz not null,
  available_capacity_kg numeric not null check (available_capacity_kg >= 0),
  contact_number text not null
);

create index if not exists idx_backhaul_mandi on backhaul_trucks (from_mandi_id);

-- ═══════════════════════════ Row-Level Security ═══════════════════════════
-- Enable RLS on every table that holds user-scoped or role-scoped data.
-- (Idempotent — ENABLE ROW LEVEL SECURITY on an already-enabled table is a no-op.)
alter table users enable row level security;
alter table parchi_ledger enable row level security;
alter table sowing_signals enable row level security;
alter table fpo_price_entries enable row level security;
alter table fpo_survey_responses enable row level security;
alter table disputes enable row level security;
alter table storage_directory enable row level security;
alter table backhaul_trucks enable row level security;
alter table crops enable row level security;
alter table mandis enable row level security;

-- crops / mandis / storage_directory: public-read for every authenticated role.
drop policy if exists "crops_public_read" on crops;
create policy "crops_public_read" on crops
  for select to authenticated using (true);

drop policy if exists "mandis_public_read" on mandis;
create policy "mandis_public_read" on mandis
  for select to authenticated using (true);

drop policy if exists "storage_directory_public_read" on storage_directory;
create policy "storage_directory_public_read" on storage_directory
  for select to authenticated using (true);

-- sowing_signals: public-read for every authenticated role (farmers, traders,
-- FPOs, admin all need to see the current signal).
drop policy if exists "sowing_signals_public_read" on sowing_signals;
create policy "sowing_signals_public_read" on sowing_signals
  for select to authenticated using (true);

-- backhaul_trucks: public-read (farmers browse, FPO/admin manage — see insert
-- policy below).
drop policy if exists "backhaul_public_read" on backhaul_trucks;
create policy "backhaul_public_read" on backhaul_trucks
  for select to authenticated using (true);

-- parchi_ledger: farmers see only their own rows.
drop policy if exists "parchi_farmer_select_own" on parchi_ledger;
create policy "parchi_farmer_select_own" on parchi_ledger
  for select to authenticated
  using (farmer_id = auth.uid());

-- parchi_ledger: traders see rows where they are the recording trader, and
-- can insert new ones as that trader.
drop policy if exists "parchi_trader_select_own" on parchi_ledger;
create policy "parchi_trader_select_own" on parchi_ledger
  for select to authenticated
  using (trader_id = auth.uid());

drop policy if exists "parchi_trader_insert" on parchi_ledger;
create policy "parchi_trader_insert" on parchi_ledger
  for insert to authenticated
  with check (trader_id = auth.uid());

-- disputes: farmers see only their own disputes.
drop policy if exists "disputes_farmer_select_own" on disputes;
create policy "disputes_farmer_select_own" on disputes
  for select to authenticated
  using (raised_by = auth.uid());

drop policy if exists "disputes_insert_own" on disputes;
create policy "disputes_insert_own" on disputes
  for insert to authenticated
  with check (raised_by = auth.uid());

-- fpo_price_entries / fpo_survey_responses / backhaul_trucks: FPO role can
-- insert and select their own submissions.
drop policy if exists "fpo_price_entries_select_own" on fpo_price_entries;
create policy "fpo_price_entries_select_own" on fpo_price_entries
  for select to authenticated
  using (fpo_id = auth.uid());

drop policy if exists "fpo_price_entries_insert" on fpo_price_entries;
create policy "fpo_price_entries_insert" on fpo_price_entries
  for insert to authenticated
  with check (fpo_id = auth.uid());

drop policy if exists "fpo_survey_select_own" on fpo_survey_responses;
create policy "fpo_survey_select_own" on fpo_survey_responses
  for select to authenticated
  using (fpo_id = auth.uid());

drop policy if exists "fpo_survey_insert" on fpo_survey_responses;
create policy "fpo_survey_insert" on fpo_survey_responses
  for insert to authenticated
  with check (fpo_id = auth.uid());

drop policy if exists "backhaul_fpo_insert" on backhaul_trucks;
create policy "backhaul_fpo_insert" on backhaul_trucks
  for insert to authenticated
  with check (exists (
    select 1 from users where id = auth.uid() and role in ('fpo', 'admin')
  ));

-- users: a user can read/update only their own row.
drop policy if exists "users_select_own" on users;
create policy "users_select_own" on users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update to authenticated
  using (id = auth.uid());

-- ═══════════════════════════ Auth-user sync trigger ═══════════════════════════
-- Every RLS policy keys off `auth.uid()`. For those policies to match, the
-- `users.id` column MUST equal the Supabase Auth user's UUID. This trigger
-- enforces that: when an auth user is created/updated, the matching `users`
-- row is kept in sync. Without it, `users.id` (a fresh UUID from the app's
-- own insert) would never equal `auth.uid()`, and every farmer/trader/FPO
-- RLS policy would silently reject their own writes.
create or replace function sync_auth_user_to_users()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.users (id, role, name, phone)
    values (new.id,
      case
        when new.raw_user_meta_data->>'role' in ('farmer','trader','fpo','admin') then (new.raw_user_meta_data->>'role')::public.user_role
        else 'farmer'::public.user_role
      end,
      coalesce(new.raw_user_meta_data->>'name', 'Farmer'),
      new.phone)
    on conflict (id) do nothing;
    return new;
  elsif tg_op = 'UPDATE' then
    update public.users
    set name = coalesce(new.raw_user_meta_data->>'name', name),
        phone = coalesce(new.phone, phone)
    where id = new.id;
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_auth_user_to_users on auth.users;
create trigger trg_sync_auth_user_to_users
  after insert or update on auth.users
  for each row execute function sync_auth_user_to_users();

-- The app's own sign-up route (app/api/auth/signup/route.ts) inserts the
-- `users` row with the SAME UUID as the auth user, so the trigger above is a
-- backstop — it keeps the two tables in sync even if a row is created
-- outside the app (e.g. via the Supabase dashboard or a migration).