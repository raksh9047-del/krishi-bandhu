-- KrishiBandhu — Phase 4 addendum migration.
--
-- The original spec's Sowing Signal calculation blends "seed-subsidy
-- disbursement data" against a three-year average, but Phase 2's schema
-- never defined a table to hold that disbursement history. Adding it here,
-- as its own migration, rather than editing supabase/schema.sql after the
-- fact — run this AFTER schema.sql.

create table subsidy_disbursements (
  id uuid primary key default gen_random_uuid(),
  crop_id text not null references crops(id) on delete restrict,
  district text not null,
  month date not null, -- always the 1st of the month, e.g. 2024-06-01
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index idx_subsidy_crop_district_month on subsidy_disbursements (crop_id, district, month);

alter table subsidy_disbursements enable row level security;

-- Public-read for every authenticated role, same as crops/mandis — this is
-- reference/analytics data, not user-scoped.
create policy "subsidy_disbursements_public_read" on subsidy_disbursements
  for select to authenticated using (true);

-- Only FPO/admin roles should ever write this in production; for the pilot
-- build it's populated entirely by Phase 8's seed script via a service-role
-- key, so no insert policy is granted to the anon/authenticated roles here.
-- Add one scoped to your admin role check if you build a live-entry UI for
-- this later.
