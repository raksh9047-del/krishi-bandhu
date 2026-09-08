-- KrishiBandhu — Phase 6 addendum migration.
--
-- Fixing a gap from Phase 2: `fpo_price_entries` was only given a
-- "select own" policy (fpo_id = auth.uid()), which is wrong — this table is
-- described in the spec itself as "the platform's real, independent price
-- source," read by the farmer app's NetRealizationCalculator, the trader
-- dashboard, the Mandi Heatmap, and the Government Analytics dashboard.
-- Only INSERT should be restricted to the entering FPO; SELECT needs to be
-- public, same as crops/mandis/storage_directory.

drop policy if exists "fpo_price_entries_select_own" on fpo_price_entries;

create policy "fpo_price_entries_public_read" on fpo_price_entries
  for select to authenticated using (true);

-- fpo_price_entries_insert (fpo_id = auth.uid()) from Phase 2 is unchanged
-- and still correct — only who can WRITE a price entry is restricted.
