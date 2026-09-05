create table if not exists game_trophies (
  id serial primary key,
  platform text not null check (platform in ('ps4', 'ps5')),
  title_id text not null,
  trophy_title_id text,
  trophy_id integer not null,
  trophy_group_id text,
  trophy_type text,
  trophy_name text,
  trophy_detail text,
  trophy_icon_url text,
  trophy_hidden boolean,
  trophy_progress_target_value text,
  earned boolean not null default false,
  earned_at timestamptz,
  metadata_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, title_id, trophy_id)
);

create index if not exists game_trophies_title_idx
  on game_trophies (platform, title_id);

create index if not exists game_trophies_npwr_idx
  on game_trophies (trophy_title_id);

create index if not exists game_trophies_metadata_idx
  on game_trophies (metadata_synced_at);
