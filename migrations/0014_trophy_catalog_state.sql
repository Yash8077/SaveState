alter table game_trophies
  add column if not exists trophy_set_version text;

alter table game_trophies
  add column if not exists catalog_synced_at timestamptz;

create index if not exists game_trophies_catalog_state_idx
  on game_trophies (trophy_title_id, catalog_synced_at);
