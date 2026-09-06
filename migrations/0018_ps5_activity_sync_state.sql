-- Phase 4 / Layer 2 groundwork: server-visible PS5 activity sync state.
--
-- last_seen_at remains device presence/activity. These fields describe the
-- actual activity-data synchronization lifecycle and are intentionally kept
-- separate.
alter table ps5_devices
  add column if not exists activity_sync_status text not null default 'never_synced'
    check (activity_sync_status in ('never_synced', 'syncing', 'synced', 'failed'));

alter table ps5_devices
  add column if not exists activity_last_attempt_at timestamptz;

alter table ps5_devices
  add column if not exists activity_last_success_at timestamptz;

alter table ps5_devices
  add column if not exists activity_last_error_at timestamptz;

alter table ps5_devices
  add column if not exists activity_last_error text;
