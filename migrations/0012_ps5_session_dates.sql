-- PlayStation session dates become the source of truth for matched library games.
-- Backfill existing history and keep dates in sync for future activity imports.

with matches as (
  select
    ge.id,
    min(substr(e.created_date, 1, 10)::date) as first_session,
    max(substr(e.created_date, 1, 10)::date) as last_session
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
       when 'UP' then 3 when 'JP' then 4 when 'HP' then 5 else 6
     end
     limit 1
  ) t on regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g') =
         regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
  group by ge.id
)
update game_entries ge
   set started_at = matches.first_session::date,
       finished_at = matches.last_session::date,
       updated_at = now()
  from matches
 where ge.id = matches.id;

create or replace function savestate_sync_ps5_session_dates()
returns trigger
language plpgsql
as $$
begin
  with matched_library as (
    select ge.id
      from game_entries ge
      join lateral (
        select t.name
          from playstation_titles t
         where t.platform = case
           when new.title_id like 'PPSA%' then 'ps5'
           when new.title_id like 'CUSA%' then 'ps4'
           else ''
         end
           and t.title_id = new.title_id
           and t.is_game = true
         order by case t.region
           when 'IN' then 0 when 'AS' then 1 when 'EP' then 2
           when 'UP' then 3 when 'JP' then 4 when 'HP' then 5 else 6
         end
         limit 1
      ) t on regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g') =
             regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
     where ge.user_id = new.user_id
     limit 1
  ), session_bounds as (
    select
      min(substr(e.created_date, 1, 10)::date) as first_session,
      max(substr(e.created_date, 1, 10)::date) as last_session
    from ps5_activity_events e
   where e.user_id = new.user_id
     and e.title_id = new.title_id
  )
  update game_entries ge
     set started_at = session_bounds.first_session::date,
         finished_at = session_bounds.last_session::date,
         updated_at = now()
    from matched_library, session_bounds
   where ge.id = matched_library.id;

  return new;
end;
$$;

drop trigger if exists trg_savestate_sync_ps5_session_dates on ps5_activity_events;

create trigger trg_savestate_sync_ps5_session_dates
after insert or update on ps5_activity_events
for each row
execute function savestate_sync_ps5_session_dates();

-- Also handle the inverse case: a library game can be added after its
-- PlayStation activity was already imported. In that case the new library
-- row should immediately inherit its historical first/last session dates.
create or replace function savestate_sync_library_entry_ps5_dates()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  with matched_activity as (
    select
      min(substr(e.created_date, 1, 10)::date) as first_session,
      max(substr(e.created_date, 1, 10)::date) as last_session
    from ps5_activity_events e
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
         when 'UP' then 3 when 'JP' then 4 when 'HP' then 5 else 6
       end
       limit 1
    ) t on regexp_replace(lower(new.title), '[^a-z0-9]+', '', 'g') =
           regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
   where e.user_id = new.user_id
  )
  update game_entries ge
     set started_at = matched_activity.first_session::date,
         finished_at = matched_activity.last_session::date,
         updated_at = now()
    from matched_activity
   where ge.id = new.id
     and matched_activity.first_session is not null;

  return new;
end;
$$;

drop trigger if exists trg_savestate_sync_library_entry_ps5_dates on game_entries;

create trigger trg_savestate_sync_library_entry_ps5_dates
after insert or update of title on game_entries
for each row
execute function savestate_sync_library_entry_ps5_dates();
