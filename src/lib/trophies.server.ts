import type { Sql } from "@/lib/db";
import type { TrophyCatalogInput, TrophySyncInput } from "@/lib/trophy-schema";

function normalizeTitleId(value: string): string {
  return value.trim().toUpperCase().replace(/_00$/, "");
}

function getPlatform(titleId: string): "ps4" | "ps5" | null {
  const normalized = normalizeTitleId(titleId);
  if (normalized.startsWith("CUSA")) return "ps4";
  if (normalized.startsWith("PPSA")) return "ps5";
  return null;
}

function normalizeTrophyTitleId(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export async function syncPs5Trophies(sql: Sql, input: TrophySyncInput) {
  let gamesProcessed = 0;
  let trophiesMarked = 0;
  let trophiesAlreadyEarned = 0;
  let unknownTitles = 0;
  let malformedGames = 0;

  for (const game of input.games) {
    const titleId = normalizeTitleId(game.titleId);
    const platform = getPlatform(titleId);
    const trophyTitleId = normalizeTrophyTitleId(game.trophyTitleId);

    if (!platform) {
      malformedGames++;
      continue;
    }

    if (trophyTitleId) {
      await sql`
        insert into trophy_title_game_map (
          platform, title_id, trophy_title_id, updated_at
        ) values (
          ${platform}, ${titleId}, ${trophyTitleId}, now()
        )
        on conflict (platform, title_id, trophy_title_id)
        do update set updated_at = now()
      `;
    }

    const trophyIds = [...new Set(game.trophyIds)];
    if (trophyIds.length === 0) {
      gamesProcessed++;
      continue;
    }

    const titles = await sql<{
      title_id: string;
      platform: "ps4" | "ps5";
    }>`
      select title_id, platform
      from playstation_titles
      where platform = ${platform}
        and title_id = ${titleId}
        and is_game = true
      order by case when region = '' then 0 else 1 end, region
      limit 1
    `;

    if (titles.length === 0) {
      unknownTitles++;
      continue;
    }

    for (const trophyId of trophyIds) {
      const existing = await sql<{
        id: number;
        earned: boolean;
      }>`
        select id, earned
        from game_trophies
        where platform = ${platform}
          and title_id = ${titleId}
          and trophy_title_id = ${trophyTitleId}
          and trophy_id = ${trophyId}
        limit 1
      `;

      if (existing.length === 0) {
        // Older rows may have been created before trophy_title_id was known.
        // Rebind that placeholder row instead of losing its earned state.
        const legacy = trophyTitleId
          ? await sql<{ id: number; earned: boolean }>`
              select id, earned
              from game_trophies
              where platform = ${platform}
                and title_id = ${titleId}
                and trophy_title_id = ''
                and trophy_id = ${trophyId}
              limit 1
            `
          : [];

        if (legacy.length) {
          await sql`
            update game_trophies
            set trophy_title_id = ${trophyTitleId},
                earned = true,
                earned_at = coalesce(earned_at, now()),
                updated_at = now()
            where id = ${legacy[0].id}
          `;
          trophiesMarked++;
          continue;
        }

        await sql`
          insert into game_trophies (
            platform,
            title_id,
            trophy_title_id,
            trophy_id,
            earned,
            earned_at
          ) values (
            ${platform},
            ${titleId},
            ${trophyTitleId},
            ${trophyId},
            true,
            now()
          )
          on conflict (platform, title_id, trophy_title_id, trophy_id)
          do update set
            earned = true,
            earned_at = coalesce(game_trophies.earned_at, now()),
            updated_at = now()
        `;
        trophiesMarked++;
      } else if (!existing[0].earned) {
        await sql`
          update game_trophies
          set earned = true,
              earned_at = coalesce(earned_at, now()),
              updated_at = now()
          where id = ${existing[0].id}
        `;
        trophiesMarked++;
      } else {
        await sql`
          update game_trophies
          set updated_at = now()
          where id = ${existing[0].id}
        `;
        trophiesAlreadyEarned++;
      }
    }

    gamesProcessed++;
  }

  await sql`
    update ps5_devices
    set last_seen_at = now()
    where id = ${input.deviceId}
  `;

  return {
    gamesProcessed,
    trophiesMarked,
    trophiesAlreadyEarned,
    unknownTitles,
    malformedGames,
  };
}

export async function listTrophyCatalogTargets(sql: Sql) {
  return sql<{
    trophy_title_id: string;
    platform: "ps4" | "ps5";
    trophy_set_version: string | null;
    total_trophies: number;
    synced_at: string;
  }>`
    select
      trophy_title_id,
      platform,
      trophy_set_version,
      total_trophies,
      synced_at::text as synced_at
    from trophy_catalogs
    order by platform, trophy_title_id
  `;
}

export async function listUncachedTrophyCatalogTargets(sql: Sql) {
  return sql<{
    trophy_title_id: string;
    platform: "ps4" | "ps5";
  }>`
    select distinct platform, trophy_title_id
    from (
      select
        gm.platform,
        gm.trophy_title_id
      from trophy_title_game_map gm
      left join trophy_catalogs tc
        on tc.platform = gm.platform
       and tc.trophy_title_id = gm.trophy_title_id
      where gm.trophy_title_id <> ''
        and tc.trophy_title_id is null

      union

      select
        gt.platform,
        gt.trophy_title_id
      from game_trophies gt
      left join trophy_catalogs tc
        on tc.platform = gt.platform
       and tc.trophy_title_id = gt.trophy_title_id
      where gt.trophy_title_id <> ''
        and tc.trophy_title_id is null

      union

      select
        tc.platform,
        tc.trophy_title_id
      from trophy_catalogs tc
      left join (
        select platform, trophy_title_id, count(*)::int as row_count
        from game_trophies
        where trophy_title_id <> ''
        group by platform, trophy_title_id
      ) gt
        on gt.platform = tc.platform
       and gt.trophy_title_id = tc.trophy_title_id
      where tc.trophy_title_id <> ''
        and coalesce(gt.row_count, 0) < tc.total_trophies
    ) targets
    order by platform, trophy_title_id
  `;
}

export async function applyTrophyCatalog(
  sql: Sql,
  input: TrophyCatalogInput,
) {
  const titleRows = await sql<{ title_id: string }>`
    select distinct title_id
    from (
      select title_id
      from trophy_title_game_map
      where platform = ${input.platform}
        and trophy_title_id = ${input.trophyTitleId}
      union
      select title_id
      from game_trophies
      where platform = ${input.platform}
        and trophy_title_id = ${input.trophyTitleId}
    ) mapped
  `;

  let updated = 0;

  for (const title of titleRows) {
    for (const trophy of input.trophies) {
      const target = trophy.trophyProgressTargetValue;
      const existing = await sql<{ id: number }>`
        select id
        from game_trophies
        where platform = ${input.platform}
          and title_id = ${title.title_id}
          and trophy_title_id = ${input.trophyTitleId}
          and trophy_id = ${trophy.trophyId}
        limit 1
      `;

      if (existing.length) {
        await sql`
          update game_trophies
          set trophy_group_id = ${trophy.trophyGroupId ?? null},
              trophy_type = ${trophy.trophyType ?? null},
              trophy_name = ${trophy.trophyName ?? null},
              trophy_detail = ${trophy.trophyDetail ?? null},
              trophy_icon_url = ${trophy.trophyIconUrl ?? null},
              trophy_hidden = ${trophy.trophyHidden ?? null},
              trophy_progress_target_value = ${target == null ? null : String(target)},
              metadata_synced_at = now(),
              updated_at = now()
          where id = ${existing[0].id}
        `;
      } else {
        const legacy = await sql<{ id: number }>`
          select id
          from game_trophies
          where platform = ${input.platform}
            and title_id = ${title.title_id}
            and trophy_title_id = ''
            and trophy_id = ${trophy.trophyId}
          limit 1
        `;

        if (legacy.length) {
          await sql`
            update game_trophies
            set trophy_title_id = ${input.trophyTitleId},
                trophy_group_id = ${trophy.trophyGroupId ?? null},
                trophy_type = ${trophy.trophyType ?? null},
                trophy_name = ${trophy.trophyName ?? null},
                trophy_detail = ${trophy.trophyDetail ?? null},
                trophy_icon_url = ${trophy.trophyIconUrl ?? null},
                trophy_hidden = ${trophy.trophyHidden ?? null},
                trophy_progress_target_value = ${target == null ? null : String(target)},
                metadata_synced_at = now(),
                updated_at = now()
            where id = ${legacy[0].id}
          `;
        } else {
          await sql`
          insert into game_trophies (
            platform,
            title_id,
            trophy_title_id,
            trophy_id,
            trophy_group_id,
            trophy_type,
            trophy_name,
            trophy_detail,
            trophy_icon_url,
            trophy_hidden,
            trophy_progress_target_value,
            earned,
            metadata_synced_at,
            created_at,
            updated_at
          ) values (
            ${input.platform},
            ${title.title_id},
            ${input.trophyTitleId},
            ${trophy.trophyId},
            ${trophy.trophyGroupId ?? null},
            ${trophy.trophyType ?? null},
            ${trophy.trophyName ?? null},
            ${trophy.trophyDetail ?? null},
            ${trophy.trophyIconUrl ?? null},
            ${trophy.trophyHidden ?? null},
            ${target == null ? null : String(target)},
            false,
            now(),
            now(),
            now()
          )
          on conflict (platform, title_id, trophy_title_id, trophy_id)
          do update set
            trophy_group_id = excluded.trophy_group_id,
            trophy_type = excluded.trophy_type,
            trophy_name = excluded.trophy_name,
            trophy_detail = excluded.trophy_detail,
            trophy_icon_url = excluded.trophy_icon_url,
            trophy_hidden = excluded.trophy_hidden,
            trophy_progress_target_value = excluded.trophy_progress_target_value,
            metadata_synced_at = now(),
            updated_at = now()
        `;
        }
      }

      updated++;
    }
  }

  await sql`
    insert into trophy_catalogs (
      platform,
      trophy_title_id,
      trophy_set_version,
      total_trophies,
      synced_at,
      updated_at
    ) values (
      ${input.platform},
      ${input.trophyTitleId},
      ${input.trophySetVersion ?? null},
      ${input.trophies.length},
      now(),
      now()
    )
    on conflict (platform, trophy_title_id)
    do update set
      trophy_set_version = excluded.trophy_set_version,
      total_trophies = excluded.total_trophies,
      synced_at = now(),
      updated_at = now()
  `;

  return { updated };
}

/**
 * Legacy compatibility export. The shared read implementation in
 * trophy-read.server.ts is the canonical path used by the API routes.
 */
export async function getGameTrophyProgress(
  sql: Sql,
  platform: "ps4" | "ps5",
  titleId: string,
) {
  const normalizedTitleId = normalizeTitleId(titleId);
  const rows = await sql<{
    trophy_title_id: string;
    trophy_id: number;
    trophy_type: string | null;
    trophy_name: string | null;
    trophy_detail: string | null;
    trophy_icon_url: string | null;
    trophy_hidden: boolean | null;
    earned: boolean;
    earned_at: string | null;
  }>`
    select
      trophy_title_id,
      trophy_id,
      trophy_type,
      trophy_name,
      trophy_detail,
      trophy_icon_url,
      trophy_hidden,
      earned,
      earned_at::text as earned_at
    from game_trophies
    where platform = ${platform}
      and title_id = ${normalizedTitleId}
    order by
      case when earned then 0 else 1 end,
      case trophy_type
        when 'platinum' then 0
        when 'gold' then 1
        when 'silver' then 2
        when 'bronze' then 3
        else 4
      end,
      earned_at desc nulls last,
      trophy_title_id,
      trophy_id
  `;

  const total = rows.length;
  const earned = rows.filter((row) => row.earned).length;
  const byType = (type: string) => {
    const all = rows.filter((row) => row.trophy_type === type);
    return { earned: all.filter((row) => row.earned).length, total: all.length };
  };

  return {
    total,
    earned,
    percentage: total === 0 ? 0 : Number(((earned / total) * 100).toFixed(1)),
    platinum: byType("platinum"),
    gold: byType("gold"),
    silver: byType("silver"),
    bronze: byType("bronze"),
    trophies: rows,
  };
}

export function summarizeTrophyGames(
  games: Array<{
    total: number;
    earned: number;
    platinum: { earned: number };
    gold: { earned: number };
    silver: { earned: number };
    bronze: { earned: number };
  }>,
) {
  const summary = {
    total: 0,
    earned: 0,
    platinum: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    games: games.length,
    percentage: 0,
  };

  for (const game of games) {
    summary.total += game.total;
    summary.earned += game.earned;
    summary.platinum += game.platinum.earned;
    summary.gold += game.gold.earned;
    summary.silver += game.silver.earned;
    summary.bronze += game.bronze.earned;
  }

  summary.percentage =
    summary.total === 0
      ? 0
      : Number(((summary.earned / summary.total) * 100).toFixed(1));

  return summary;
}
