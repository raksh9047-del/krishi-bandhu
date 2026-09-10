-- 008_rls_hardening.sql
-- Hardens missing RLS policies discovered during the Phase 9 audit.
-- Applied after 007_alerts.sql.

-- ── backhaul_trucks: restrict inserts to FPO / admin roles ──────────────
-- The permissive `backhaul_fpo_insert` from schema.sql allowed any
-- authenticated user to post a truck.  Replace it with a role-gated policy.
drop policy if exists "backhaul_fpo_insert" on backhaul_trucks;

create policy "backhaul_fpo_insert" on backhaul_trucks
  for insert to authenticated
  with check (exists (
    select 1 from users where id = auth.uid() and role in ('fpo', 'admin')
  ));

-- ── backhaul_trucks: allow FPO / admin to update and delete their listings ─
drop policy if exists "backhaul_fpo_update" on backhaul_trucks;
create policy "backhaul_fpo_update" on backhaul_trucks
  for update to authenticated
  using (exists (
    select 1 from users where id = auth.uid() and role in ('fpo', 'admin')
  ))
  with check (exists (
    select 1 from users where id = auth.uid() and role in ('fpo', 'admin')
  ));

drop policy if exists "backhaul_fpo_delete" on backhaul_trucks;
create policy "backhaul_fpo_delete" on backhaul_trucks
  for delete to authenticated
  using (exists (
    select 1 from users where id = auth.uid() and role in ('fpo', 'admin')
  ));

-- ── alerts: admin-only insert / update / delete (service-role in pilot) ───
-- The alerts table is written by the service-role admin client in the pilot.
-- These policies prevent anon or unprivileged authenticated writes while
-- keeping reads open for the farmer's own alerts.
-- (007_alerts.sql already created `alerts_farmer_select_own` — drop first so
-- this migration is idempotent against the 007 definition.)
drop policy if exists "alerts_farmer_select_own" on alerts;
create policy "alerts_farmer_select_own" on alerts
  for select to authenticated
  using (farmer_id = auth.uid());

drop policy if exists "alerts_admin_insert" on alerts;
create policy "alerts_admin_insert" on alerts
  for insert to authenticated
  with check (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

drop policy if exists "alerts_admin_update" on alerts;
create policy "alerts_admin_update" on alerts
  for update to authenticated
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

drop policy if exists "alerts_admin_delete" on alerts;
create policy "alerts_admin_delete" on alerts
  for delete to authenticated
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

-- ── sowing_signals: admin-only update (recalculation writes) ─────────────
drop policy if exists "sowing_signals_admin_update" on sowing_signals;
create policy "sowing_signals_admin_update" on sowing_signals
  for update to authenticated
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

-- ── disputes: allow traders to view disputes related to their parchis ────
drop policy if exists "disputes_trader_select" on disputes;
create policy "disputes_trader_select" on disputes
  for select to authenticated
  using (exists (
    select 1 from parchi_ledger p
    where p.id = disputes.parchi_id and p.trader_id = auth.uid()
  ));
