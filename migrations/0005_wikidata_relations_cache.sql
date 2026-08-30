create table if not exists wikidata_relations_cache (
  igdb_id bigint primary key,
  prequel_igdb_id bigint,
  sequel_igdb_id bigint,
  prequel_slug text,
  sequel_slug text,
  fetched_at timestamptz not null default now()
);
