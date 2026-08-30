create table if not exists igdb_token_cache (
  client_id text primary key,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
