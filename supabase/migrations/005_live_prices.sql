-- KrishiBandhu — Live price sync (Agmarknet) addendum.
--
-- The Python reference (krishibandhu_live_features.py) writes live prices
-- into a `prices` table with a source flag. This migration adds that table
-- to Supabase so the ported /api/prices/sync and /api/prices/:crop/:mandi
-- routes have somewhere to write and read from.
--
-- Conventions that matter:
--   * source is a first-class column: 'live' = Agmarknet, 'fpo' = FPO manual
--     entry, 'seed' = pilot seed data. The read path prefers 'live' over the
--     others regardless of recency (same rule as the Python original).
--   * A unique (crop_id, mandi_id, date, source) index makes re-syncs
--     idempotent — the sync route upserts on those four columns.
--   * Writes go through the server-side admin client only (service role);
--     authenticated clients get the same public read as fpo_price_entries.

create table prices (
  id uuid primary key default gen_random_uuid(),
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  price numeric not null check (price > 0),
  date date not null,
  source text not null check (source in ('live', 'fpo', 'seed')),
  arrival_volume_tons numeric check (arrival_volume_tons >= 0),
  fetched_at timestamptz not null default now()
);

create unique index idx_prices_crop_mandi_date_source on prices (crop_id, mandi_id, date, source);
create index idx_prices_crop_mandi on prices (crop_id, mandi_id);

alter table prices enable row level security;

create policy "prices_public_read" on prices
  for select to authenticated using (true);