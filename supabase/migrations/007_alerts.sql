-- ════════════════════════════════════════════════════════════════════════
-- 007_alerts.sql — Farmer Alert Messages
--
-- In-app alert messages delivered to a farmer: parchi (sale receipt)
-- confirmations, market price movements, sowing-risk warnings, and system
-- notices. Server routes (lib/alerts.ts) write through the service-role
-- admin client; the farmer reads their own inbox via GET /api/alerts.
--
-- Apply via the Supabase SQL editor, or per BUILD_STATUS.md: npx supabase
-- login && npx supabase link && npx supabase db push.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references users(id) on delete cascade,
  type text not null check (
    type in ('parchi_recorded', 'price_alert', 'sowing_alert', 'arrival', 'system')
  ),
  severity text not null default 'info' check (
    severity in ('info', 'warning', 'danger')
  ),
  title text not null,
  message text not null,
  -- Per-type context: { crop_id, mandi_id, amount, hash, ... }
  payload jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- The farmer's alert inbox, newest first.
create index if not exists idx_alerts_farmer_created on alerts (farmer_id, created_at desc);

-- Farmers see (and mark read) only their own alerts. Server routes bypass
-- RLS via the service-role client; these policies are for any future direct
-- end-user client session.
alter table alerts enable row level security;

drop policy if exists "alerts_farmer_select_own" on alerts;
create policy "alerts_farmer_select_own" on alerts
  for select to authenticated
  using (farmer_id = auth.uid());

drop policy if exists "alerts_farmer_update_own" on alerts;
create policy "alerts_farmer_update_own" on alerts
  for update to authenticated
  using (farmer_id = auth.uid());