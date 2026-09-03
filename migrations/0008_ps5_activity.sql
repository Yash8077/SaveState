create table if not exists ps5_devices (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  name text not null default 'PS5',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists ps5_devices_user_idx on ps5_devices (user_id);

create table if not exists ps5_activity_events (
  id bigserial primary key,
  user_id text not null references "user" ("id") on delete cascade,
  device_id text not null references ps5_devices (id) on delete cascade,
  source_rowid bigint not null,
  title_id text not null,
  title_name text,
  created_date text not null,
  total_fg_time integer not null default 0,
  received_at timestamptz not null default now(),
  unique (device_id, source_rowid)
);

create index if not exists ps5_activity_user_date_idx
  on ps5_activity_events (user_id, received_at desc);
create index if not exists ps5_activity_user_title_idx
  on ps5_activity_events (user_id, title_id, received_at desc);
