-- 009_epo_manual_entry.sql
-- KrishiBandhu — EPO (Electronic Price Observation) manual price entry.
--
-- The Agmarknet feed is a daily publication, not a live stream, and it does not
-- cover every crop/mandi pair or every village-level market. The EPO module
-- lets a registered FPO coordinator (or an authorized assayer) submit a manual
-- price observation for a crop+mandi, which becomes an independent, farmer-
-- visible price source alongside Agmarknet 'live' and FPO 'fpo' entries.
--
-- Semantics:
--   * source = 'epo'  — a human-observed price, timestamped at observation time.
--   * It is NEVER surfaced as "live" by the read path: getMarketPriceView
--     only returns status='live' for Agmarknet rows, so an EPO entry renders
--     with the honest "observed, not live" label (see livePrice.epoSource).
--   * farmer-owned copy: every EPO entry triggers a farmer-facing alert with
--     the hash, so the farmer has their own record independent of the agent.
--
-- Apply via the Supabase SQL editor, or per BUILD_STATUS.md: npx supabase
-- login && npx supabase link && npx supabase db push.

create table if not exists epo_price_entries (
  id uuid primary key default gen_random_uuid(),
  observer_id uuid not null references users(id) on delete restrict,
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  price_per_quintal numeric not null check (price_per_quintal > 0),
  arrival_volume_tons numeric check (arrival_volume_tons >= 0),
  observed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_epo_crop_mandi on epo_price_entries (crop_id, mandi_id);
create index if not exists idx_epo_observed_at on epo_price_entries (observed_at desc);

alter table epo_price_entries enable row level security;

-- Observers (FPO / admin) manage their own entries.
drop policy if exists "epo_select_own" on epo_price_entries;
create policy "epo_select_own" on epo_price_entries
  for select to authenticated
  using (observer_id = auth.uid());

drop policy if exists "epo_insert_own" on epo_price_entries;
create policy "epo_insert_own" on epo_price_entries
  for insert to authenticated
  with check (
    observer_id = auth.uid()
    and exists (select 1 from users where id = auth.uid() and role in ('fpo', 'admin'))
  );

drop policy if exists "epo_update_own" on epo_price_entries;
create policy "epo_update_own" on epo_price_entries
  for update to authenticated
  using (observer_id = auth.uid())
  with check (observer_id = auth.uid());

drop policy if exists "epo_delete_own" on epo_price_entries;
create policy "epo_delete_own" on epo_price_entries
  for delete to authenticated
  using (observer_id = auth.uid());