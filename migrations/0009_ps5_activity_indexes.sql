create index if not exists ps5_activity_device_rowid_idx
  on ps5_activity_events (device_id, source_rowid);
create index if not exists ps5_activity_user_created_idx
  on ps5_activity_events (user_id, created_date desc);
