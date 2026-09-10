create table if not exists catalog_cache (
  cache_key text primary key,
  kind text not null,
  catalog_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists catalog_cache_kind_fetched_idx
  on catalog_cache (kind, fetched_at);
