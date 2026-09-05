create table if not exists trophy_catalogs (
  platform text not null
    check (platform in ('ps4', 'ps5')),
  trophy_title_id text not null,
  trophy_set_version text,
  total_trophies integer not null default 0,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (platform, trophy_title_id)
);

create index if not exists trophy_catalogs_sync_idx
  on trophy_catalogs (synced_at);
