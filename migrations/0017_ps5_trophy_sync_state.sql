-- Phase 4 / Layer 1: durable incremental PS5 trophy sync state.
--
-- The device-wide lock prevents concurrent payloads from racing one another.
-- Its timestamp is intentionally separate from the sync state so a crashed
-- payload cannot wedge future syncs forever.
alter table ps5_devices
  add column if not exists trophy_sync_lock_acquired_at timestamptz;

create index if not exists ps5_devices_trophy_sync_lock_idx
  on ps5_devices (trophy_sync_lock_acquired_at);

create table if not exists ps5_trophy_sync_state (
  device_id text not null references ps5_devices (id) on delete cascade,
  title_id text not null,
  trophy_title_id text not null default '',
  payload_hash text not null default '',
  processed_trophy_ids_json text not null default '[]',
  status text not null default 'never_synced'
    check (status in ('never_synced', 'syncing', 'synced', 'failed')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, title_id, trophy_title_id)
);

create index if not exists ps5_trophy_sync_state_status_idx
  on ps5_trophy_sync_state (device_id, status, updated_at desc);

create index if not exists ps5_trophy_sync_state_success_idx
  on ps5_trophy_sync_state (device_id, last_success_at desc);
