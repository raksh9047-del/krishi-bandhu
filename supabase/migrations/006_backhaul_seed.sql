-- KrishiBandhu — Backhaul seed data (Phase 8, Part 8).
--
-- The farmer app's BackhaulFarmerView reads backhaul_trucks filtered by the
-- selected mandi; until now the table was empty, so the screen only ever
-- showed its honest empty state. This seeds 2–3 realistic return trucks per
-- PILOT mandi only (Vashi / Lasalgaon / Pune Gultekdi) — expanding to the
-- other mandis later is more rows, not new code.
--
-- departure_time is seeded relative to now() so the data reads sensibly
-- whenever the migration is applied. Re-running the seed inserts duplicates
-- (no natural unique key) — it is meant to be run once, like schema.sql.

insert into backhaul_trucks (truck_number, from_mandi_id, to_village, departure_time, available_capacity_kg, contact_number) values
  -- Vashi (Thane district)
  ('MH-04-AB-1234', 'vashi', 'Panvel',   now() + interval '3 hours',  1800, '+91-98200-11111'),
  ('MH-04-CD-5678', 'vashi', 'Bhiwandi', now() + interval '6 hours',  2500, '+91-98200-22222'),
  ('MH-05-EF-9012', 'vashi', 'Karjat',   now() + interval '9 hours',   900, '+91-98200-33333'),
  -- Lasalgaon (Nashik district)
  ('MH-15-GH-3456', 'lasalgaon', 'Niphad',    now() + interval '2 hours',  3000, '+91-98230-44444'),
  ('MH-15-IJ-7890', 'lasalgaon', 'Chandwad',  now() + interval '7 hours',  1500, '+91-98230-55555'),
  -- Pune Gultekdi (Pune district)
  ('MH-12-KL-2345', 'pune-gultekdi', 'Baramati',    now() + interval '4 hours',  2200, '+91-98220-66666'),
  ('MH-12-MN-6789', 'pune-gultekdi', 'Indapur',     now() + interval '8 hours',  1200, '+91-98220-77777'),
  ('MH-12-OP-0123', 'pune-gultekdi', 'Rajgurunagar', now() + interval '5 hours', 1800, '+91-98220-88888');
