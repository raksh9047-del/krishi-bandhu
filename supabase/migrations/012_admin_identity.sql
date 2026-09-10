-- 012_admin_identity.sql
-- KrishiBandhu — seed an admin identity so the mandi-submission review flow
-- (migration 010 Part B) has someone to review entries, and wire the EPO
-- module's demo identity to the existing demo FPO.
--
-- The pilot identifies users by seeded uuids (P1 Farmer / P1 Trader / Demo
-- FPO); this adds the matching KrishiBandhu Admin. Idempotent: on conflict
-- (id) it keeps the existing row.

insert into users (id, role, name, phone) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin', 'KrishiBandhu Admin', '6000000001')
on conflict (id) do nothing;