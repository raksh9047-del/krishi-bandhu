-- KrishiBandhu — Phase 7 addendum migration.
--
-- Another table the spec assumes but never defines. The trader dashboard's
-- lot list is deliberately mock data for the pilot (per the original spec:
-- "shaped exactly like the real schema so swapping in live data is a
-- one-line change later"), but bids against those mock lots still need to
-- persist so the farmer side can see a real bid-accepted state.

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  trader_id uuid not null references users(id) on delete restrict,
  farmer_id uuid references users(id) on delete restrict, -- nullable: pilot lots are mocked, not always tied to a real farmer row
  crop_id text not null references crops(id) on delete restrict,
  mandi_id text not null references mandis(id) on delete restrict,
  listed_price numeric not null check (listed_price > 0),
  bid_amount numeric not null check (bid_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_bids_farmer on bids (farmer_id);
create index if not exists idx_bids_crop_mandi on bids (crop_id, mandi_id);

alter table bids enable row level security;

-- Public-read: farmers need to see bids to know when one's accepted, traders
-- need to see the list they've placed. Simpler than per-role filtering for
-- a pilot with no real lot ownership model.
drop policy if exists "bids_public_read" on bids;
create policy "bids_public_read" on bids
  for select to authenticated using (true);

-- Documented for parity even though the actual write path in this build goes
-- through the admin-client API route (POST /api/bids/create, Phase 7) rather
-- than a direct client insert.
drop policy if exists "bids_trader_insert" on bids;
create policy "bids_trader_insert" on bids
  for insert to authenticated
  with check (trader_id = auth.uid());
