-- Catalog cache metadata belongs in trophy_catalogs. Remove the
-- intermediate columns introduced by migration 0014 from game_trophies.
alter table game_trophies
  drop column if exists trophy_set_version;

alter table game_trophies
  drop column if exists catalog_synced_at;

-- The catalog sync timestamp index was only useful for the removed column.
drop index if exists game_trophies_catalog_state_idx;
