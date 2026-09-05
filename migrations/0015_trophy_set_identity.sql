-- Preserve separate PlayStation trophy sets that share a title_id.
-- This is required for collections/compilations where multiple NPWR trophy
-- sets can belong to the same PlayStation title/CUSA/PPSA.
update game_trophies
set trophy_title_id = ''
where trophy_title_id is null;

alter table game_trophies
  alter column trophy_title_id set default '';

alter table game_trophies
  alter column trophy_title_id set not null;

alter table game_trophies
  drop constraint if exists game_trophies_platform_title_id_trophy_id_key;

alter table game_trophies
  add constraint game_trophies_identity_unique
  unique (platform, title_id, trophy_title_id, trophy_id);

create index if not exists game_trophies_title_set_idx
  on game_trophies (platform, title_id, trophy_title_id);
