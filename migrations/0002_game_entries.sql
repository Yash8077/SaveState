create table if not exists game_entries (
  id serial primary key,
  user_id text not null,
  catalog_id text not null,
  title text not null,
  cover_url text,
  header_url text,
  summary text,
  release_date text,
  platforms text not null default '[]',
  genres text not null default '[]',
  metacritic integer,
  developers text not null default '[]',
  publishers text not null default '[]',
  screenshots text not null default '[]',
  status text not null default 'backlog',
  score integer,
  hours double precision,
  favorite boolean not null default false,
  notes text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create index if not exists game_entries_user_id_idx on game_entries (user_id);
create index if not exists game_entries_user_status_idx on game_entries (user_id, status);
create index if not exists game_entries_user_updated_idx on game_entries (user_id, updated_at desc);
