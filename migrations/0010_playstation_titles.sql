create table if not exists playstation_titles (
  platform text not null check (platform in ('ps4', 'ps5')),
  title_id text not null,
  concept_id bigint,
  name text not null,
  content_id text,
  region text not null default '',
  publisher_id text,
  is_game boolean not null default true,
  synced_at timestamptz not null default now(),
  primary key (platform, title_id, region)
);

create index if not exists playstation_titles_title_idx
  on playstation_titles (title_id, platform);
create index if not exists playstation_titles_game_idx
  on playstation_titles (platform, is_game, title_id);
create index if not exists playstation_titles_concept_idx
  on playstation_titles (concept_id);
