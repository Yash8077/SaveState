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
  }>`
    select trophy_title_id, min(platform) as platform
    from game_trophies
    where trophy_title_id is not null
    group by trophy_title_id
    order by trophy_title_id
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
        earned: boolean;
        earned_at: string | null;
      }>`
        select id, earned, earned_at
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
        `;
      }

      updated++;
    }
  }

  return { updated };
}
