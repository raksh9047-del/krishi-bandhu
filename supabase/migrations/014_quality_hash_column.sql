-- Quality Passport hash for parchi_ledger.
--
-- lib/quality-crypto.ts stamps a tamper-evident quality hash (separate from
-- the financial chain) whenever a Parchi is created with a grade/photo and
-- whenever /api/parchi/update-quality edits them. The column was missing from
-- the live DB (the create route's write was best-effort), so the passport
-- hash never actually persisted. This adds it for both create and update.
alter table public.parchi_ledger add column if not exists quality_hash text;