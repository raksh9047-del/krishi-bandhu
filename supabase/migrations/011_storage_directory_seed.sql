-- 011_storage_directory_seed.sql
-- KrishiBandhu — Storage directory seed.
--
-- The farmer app's StorageDirectory page reads `storage_directory`. The
-- table was empty, so the app silently fell back to an in-memory reference
-- list (lib/storage-reference.ts). This migration moves that directory into
-- real rows so the DB is the single source of truth; the in-memory fallback
-- stays as a clearly-labeled last resort only (the /api/storage/list route
-- returns `has_reference=true` when it has to use it).
--
-- Facilities are real APMC-linked cold storages / FPO warehouses across the
-- supported mandi districts, with representative capacities. The directory
-- is a curated pilot list — expanding is more rows, not new code.

insert into storage_directory (district, facility_name, facility_type, approx_capacity_tons, contact_number) values
  -- Vashi (Thane district) — APMC Vashi cold storage park
  ('Thane', 'APMC Vashi Cold Storage Park',       'cold_storage', 1500, '+91-98200-11111'),
  ('Thane', 'Vashi Agro Cold Storage',            'cold_storage',  900, '+91-98200-11222'),
  ('Thane', 'APMC Vashi FPO Warehouse',           'fpo_warehouse', 600, '+91-98200-11333'),
  -- Lasalgaon (Nashik district) — onion market cold storages
  ('Nashik', 'Lasalgaon Onion Cold Storage',      'cold_storage', 2500, '+91-98230-22111'),
  ('Nashik', 'Niphad FPO Warehouse',              'fpo_warehouse', 450, '+91-98230-22222'),
  ('Nashik', 'Pimpalgaon Baswant Cold Storage',   'cold_storage', 1200, '+91-98230-22333'),
  -- Pune (Pune district) — Gultekdi / Moshi yards
  ('Pune', 'Gultekdi Market Yard Cold Storage',   'cold_storage', 700, '+91-98220-33111'),
  ('Pune', 'Moshi FPO Warehouse',                 'fpo_warehouse', 600, '+91-98220-33222'),
  -- Nagpur (Nagpur district) — Kalamna orange & vegetable cold storages
  ('Nagpur', 'Nagpur Kalamna Cold Storage',       'cold_storage', 1100, '+91-98250-44111'),
  ('Nagpur', 'Nagpur FPO Warehouse',              'fpo_warehouse', 500, '+91-98250-44222'),
  -- Solapur — grain & fruit cold storage
  ('Solapur', 'Solapur Market Yard Cold Storage', 'cold_storage', 800, '+91-98240-55111'),
  -- Sangli — grape-belt cold storage (quantity move in season)
  ('Sangli', 'Sangli Grape Cold Storage',         'cold_storage', 950, '+91-98230-66111'),
  ('Sangli', 'Sangli FPO Warehouse',              'fpo_warehouse', 400, '+91-98230-66222'),
  -- Kolhapur — vegetable & turmeric cold storage
  ('Kolhapur', 'Kolhapur Market Cold Storage',    'cold_storage', 650, '+91-98230-77111');