-- 013_storage_real_facilities.sql
-- KrishiBandhu — Replace placeholder seed cold storages with real,
-- publicly-listed facilities across the supported mandi districts.
--
-- Sources: MPEDA cold-storage registrations (APMC Vashi cluster), APEDA
-- packhouse/cold-storage lists (Sangli/Nashik grape-pomegranate belt),
-- CONCOR CSR impact report (Lasalgaon onion cold storage), MCA/company
-- registries (Solapur/Nagpur/Kolhapur market-yard facilities) and
-- directory listings (Gultekdi, Kalamna, Shahu Market Yards).
--
-- approx_capacity_tons = published where available, otherwise a
-- representative capacity for the category. contact_number = publicly
-- listed phone where available, else 'NA' (view via the app's directory).

delete from storage_directory;

insert into storage_directory (district, facility_name, facility_type, approx_capacity_tons, contact_number) values
  -- Thane (APMC Vashi / MAFCO yard — largest import/wholesale cold cluster in MH)
  ('Thane', 'Alps Ice & Cold Storage Pvt Ltd, MAFCO Yard, APMC Vashi',      'cold_storage',  975, '+91-22-27633611'),
  ('Thane', 'GHK Cold Storage, Plot 40/1 & 40/2, MAFCO Yard, Vashi',        'cold_storage', 2000, '+91-98330-83418'),
  ('Thane', 'A.A. Cold Storage Pvt Ltd, Vashi-Turbhe Rd, APMC Vashi',       'cold_storage', 1200, 'NA'),
  ('Thane', 'Prabhu Hira Ice & Cold Storage Ltd, Sector 18, Vashi',         'cold_storage', 3000, 'NA'),
  ('Thane', 'NAFED Cold Storage & Bond Warehousing, Sector 18, Vashi',      'cold_storage', 1500, 'NA'),
  ('Thane', 'Mayur Cold Storage, Turbhe MIDC, Navi Mumbai',                 'cold_storage',  800, 'NA'),
  -- Nashik (onion belt — Lasalgaon APMC, Niphad, Pimpalgaon Baswant)
  ('Nashik', 'CONCOR Multipurpose Cold Storage, Lasalgaon (KHVS)',          'cold_storage',  800, 'NA'),
  ('Nashik', 'Kaivalya Agro Cold Storage, Vani Road, Pimpalgaon Baswant',   'cold_storage', 1200, '+91-89990-99762'),
  ('Nashik', 'Vishaka Agri Cold Storage, Vani Road, Pimpalgaon Baswant',    'cold_storage',  900, 'NA'),
  ('Nashik', 'Aarya Cold Storage & Exports, Kokangaon-Ozar Rd, Niphad',     'cold_storage',  600, 'NA'),
  -- Pune (Gultekdi market yard, Vorha belt, Kothrud)
  ('Pune', 'Shivraj Cold Storage Pvt Ltd, Gultekdi Market Yard',            'cold_storage', 1500, '+91-20-24270632'),
  ('Pune', 'Krushiraj Cold Storage LLP, Market Yard, Gultekdi',             'cold_storage', 1200, 'NA'),
  ('Pune', 'Penguin Coldstorages Pvt Ltd, Kothrud, Pune',                   'cold_storage', 2500, 'NA'),
  ('Pune', 'Jai Jinendra Cold Storage Pvt Ltd, Pune-Saswad Rd, Vadki',      'cold_storage', 3000, 'NA'),
  -- Nagpur (Kalamna APMC — oranges & vegetables)
  ('Nagpur', 'Farmico Cold Chain & Logistics, APMC Market Yard, Kalamna',   'cold_storage',10000, 'NA'),
  ('Nagpur', 'Himalaya Cold Storage & Ice Factory, B/h Kalamna Market Yard','cold_storage',  700, '+91-712-6450149'),
  ('Nagpur', 'Hariom Cold Storage Industries, Near Kalamna Market',         'cold_storage',  600, '+91-712-2790642'),
  ('Nagpur', 'Nagpur Cold Storage Pvt Ltd (city cold chain)',               'cold_storage',  500, 'NA'),
  -- Solapur (grain & fruit belt — Barsi, Pandharpur, Mulegaon)
  ('Solapur', 'Samruddhi Cold Storage & Warehousing, Hagloor, Solapur',     'cold_storage', 2500, 'NA'),
  ('Solapur', 'Godavari Cold Storage Pvt Ltd, V.M. Somani Market Yard, Barsi','cold_storage', 800, 'NA'),
  ('Solapur', 'Shri Siddheshwar Warehouse & Cold Storage, Mulegaon',        'cold_storage',  600, 'NA'),
  ('Solapur', 'Krishidhan Cold Storage, Kawathekar Complex, Pandharpur',    'cold_storage',  400, 'NA'),
  -- Sangli (grape & pomegranate pre-cooling / cold storage belt)
  ('Sangli', 'Shri Revansiddh Agrotech Cold Storage, Market Yard, Sangli',  'cold_storage',  900, 'NA'),
  ('Sangli', 'Jai Vaibhavlaxmi Cold Storage Pvt Ltd (grape & pomogranade)', 'cold_storage', 1000, 'NA'),
  ('Sangli', 'Mauli Precooling & Cold Storage (grapes)',                    'cold_storage',  700, 'NA'),
  ('Sangli', 'Shri Savliya Sheth Agrotech, Old Satara Rd, Tasgaon',         'cold_storage',  500, '+91-98265-27552'),
  -- Kolhapur (Shahu market yard)
  ('Kolhapur', 'SPD Cold Storage LLP, Shahu Market Yard',                   'cold_storage', 1000, 'NA'),
  ('Kolhapur', 'Om Agrotech Cold Storage, Shahu Market Yard',               'cold_storage',  800, '+91-98222-76452');