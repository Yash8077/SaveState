-- PS5 activity becomes the authoritative playtime source once a game is matched.
alter table game_entries
  add column if not exists playtime_seconds bigint not null default 0;

alter table game_entries
  add column if not exists playtime_source text not null default 'manual';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'game_entries_playtime_source_check'
  ) then
    alter table game_entries
      add constraint game_entries_playtime_source_check
      check (playtime_source in ('manual', 'ps5'));
  end if;
end $$;

create index if not exists game_entries_playtime_source_idx
  on game_entries (user_id, playtime_source);

-- Existing imported PS5 history should immediately populate library hours
-- when the catalog is already present.
with totals as (
  select ge.id,
         sum(e.total_fg_time)::bigint as seconds
    from game_entries ge
    join ps5_activity_events e
      on e.user_id = ge.user_id
    join lateral (
      select t.name
        from playstation_titles t
       where t.platform = case
         when e.title_id like 'PPSA%' then 'ps5'
         when e.title_id like 'CUSA%' then 'ps4'
         else ''
       end
         and t.title_id = e.title_id
         and t.is_game = true
       order by case t.region
         when 'IN' then 0 when 'AS' then 1 when 'EP' then 2
         when 'UP' then 3 when 'JP' then 4 when 'HP' then 5
         else 6 end
       limit 1
    ) t on regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g') =
           regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
   group by ge.id
)
update game_entries ge
   set playtime_seconds = totals.seconds,
       hours = round(totals.seconds / 3600.0, 1),
       playtime_source = 'ps5',
       updated_at = now()
  from totals
 where ge.id = totals.id;

-- Once playtime comes from PS5, attempts to manually change `hours`
-- are normalized back to the exact imported playtime.
create or replace function savestate_keep_ps5_hours()
returns trigger
language plpgsql
as $$
begin
  if new.playtime_source = 'ps5' then
    new.hours := round(new.playtime_seconds / 3600.0, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_savestate_keep_ps5_hours on game_entries;

create trigger trg_savestate_keep_ps5_hours
before insert or update on game_entries
for each row
execute function savestate_keep_ps5_hours();
