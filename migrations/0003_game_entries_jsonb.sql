alter table game_entries alter column platforms drop default;
alter table game_entries alter column genres drop default;
alter table game_entries alter column developers drop default;
alter table game_entries alter column publishers drop default;
alter table game_entries alter column screenshots drop default;

alter table game_entries
  alter column platforms type jsonb using platforms::jsonb;
alter table game_entries
  alter column genres type jsonb using genres::jsonb;
alter table game_entries
  alter column developers type jsonb using developers::jsonb;
alter table game_entries
  alter column publishers type jsonb using publishers::jsonb;
alter table game_entries
  alter column screenshots type jsonb using screenshots::jsonb;

alter table game_entries alter column platforms set default '[]'::jsonb;
alter table game_entries alter column genres set default '[]'::jsonb;
alter table game_entries alter column developers set default '[]'::jsonb;
alter table game_entries alter column publishers set default '[]'::jsonb;
alter table game_entries alter column screenshots set default '[]'::jsonb;

create index if not exists game_entries_platforms_gin_idx
  on game_entries using gin (platforms);
create index if not exists game_entries_genres_gin_idx
  on game_entries using gin (genres);
create index if not exists game_entries_user_updated_id_idx
  on game_entries (user_id, updated_at desc, id desc);
