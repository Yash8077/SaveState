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

export async function syncPs5Trophies(sql: Sql, input: TrophySyncInput) {
  let gamesProcessed = 0;
  let trophiesMarked = 0;
  let trophiesAlreadyEarned = 0;
  let unknownTitles = 0;
  let malformedGames = 0;

  for (const game of input.games) {
    const titleId = normalizeTitleId(game.titleId);
    const platform = getPlatform(titleId);

    if (!platform) {
      malformedGames++;
      continue;
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
          and trophy_id = ${trophyId}
        limit 1
      `;

      if (existing.length === 0) {
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
            ${game.trophyTitleId ?? null},
            ${trophyId},
            true,
            now()
          )
        `;
        trophiesMarked++;
      } else if (!existing[0].earned) {
        await sql`
          update game_trophies
          set earned = true,
              earned_at = coalesce(earned_at, now()),
              trophy_title_id = coalesce(trophy_title_id, ${game.trophyTitleId ?? null}),
              updated_at = now()
          where id = ${existing[0].id}
        `;
        trophiesMarked++;
      } else {
        await sql`
          update game_trophies
          set trophy_title_id = coalesce(trophy_title_id, ${game.trophyTitleId ?? null}),
              updated_at = now()
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
    select
      gt.trophy_title_id,
      min(gt.platform) as platform
    from game_trophies gt
    left join trophy_catalogs tc
      on tc.platform = gt.platform
     and tc.trophy_title_id = gt.trophy_title_id
    where gt.trophy_title_id is not null
      and tc.trophy_title_id is null
    group by gt.trophy_title_id
    order by gt.trophy_title_id
  `;
}

export async function applyTrophyCatalog(
  sql: Sql,
  input: TrophyCatalogInput,
) {
  const titleRows = await sql<{
    title_id: string;
  }>`
    select distinct title_id
    from game_trophies
    where platform = ${input.platform}
      and trophy_title_id = ${input.trophyTitleId}
  `;

  let updated = 0;

  for (const title of titleRows) {
    for (const trophy of input.trophies) {
      const target = trophy.trophyProgressTargetValue;

      const existing = await sql<{
        id: number;
      }>`
        select id
        from game_trophies
        where platform = ${input.platform}
          and title_id = ${title.title_id}
          and trophy_id = ${trophy.trophyId}
        limit 1
      `;

      if (existing.length) {
        await sql`
          update game_trophies
          set trophy_title_id = ${input.trophyTitleId},
              trophy_set_version = ${input.trophySetVersion ?? null},
              trophy_group_id = ${trophy.trophyGroupId ?? null},
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
        await sql`
          insert into game_trophies (
            platform,
            title_id,
            trophy_title_id,
            trophy_id,
            trophy_set_version,
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
            ${input.trophySetVersion ?? null},
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
        `;
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

export async function getGameTrophyProgress(
  sql: Sql,
  platform: "ps4" | "ps5",
  titleId: string,
) {
  const normalizedTitleId = normalizeTitleId(titleId);

  const rows = await sql<{
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
    order by trophy_id
  `;

  const total = rows.length;
  const earned = rows.filter((row) => row.earned).length;

  const byType = (type: string) => {
    const all = rows.filter((row) => row.trophy_type === type);
    return {
      earned: all.filter((row) => row.earned).length,
      total: all.length,
    };
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
