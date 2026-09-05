-- Persist the relationship between a PlayStation title and its trophy set.
-- A title can own multiple trophy sets (collections/compilations), and a
-- trophy set can exist before the user has earned any trophy from it.
create table if not exists trophy_title_game_map (
  platform text not null check (platform in ('ps4', 'ps5')),
  title_id text not null,
  trophy_title_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (platform, title_id, trophy_title_id)
);

create index if not exists trophy_title_game_map_set_idx
  on trophy_title_game_map (platform, trophy_title_id);

create index if not exists trophy_title_game_map_title_idx
  on trophy_title_game_map (platform, title_id);

-- Persist the catalog -> PlayStation identity resolution so reads do not have
-- to rediscover collection membership on every request.
create table if not exists catalog_trophy_identities (
  catalog_id text not null,
  platform text not null check (platform in ('ps4', 'ps5')),
  title_id text not null,
  resolver_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (catalog_id, platform, title_id)
);

create index if not exists catalog_trophy_identities_catalog_idx
  on catalog_trophy_identities (catalog_id);
