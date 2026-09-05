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
      gt.platform
    from game_trophies gt
    left join trophy_catalogs tc
      on tc.platform = gt.platform
     and tc.trophy_title_id = gt.trophy_title_id
    where gt.trophy_title_id is not null
      and tc.trophy_title_id is null
    group by gt.platform, gt.trophy_title_id
    order by gt.platform, gt.trophy_title_id
  `;
}

export async function applyTrophyCatalog(
  sql: Sql,
  input: TrophyCatalogInput,
) {
  const titleRows = await sql<{ title_id: string }>`
    select distinct title_id
    from game_trophies
    where platform = ${input.platform}
      and trophy_title_id = ${input.trophyTitleId}
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

export type LibraryTrophyGame = {
  gameId: number;
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  platform: "ps4" | "ps5";
  titleId: string;
  total: number;
  earned: number;
  percentage: number;
  platinum: { earned: number; total: number };
  gold: { earned: number; total: number };
  silver: { earned: number; total: number };
  bronze: { earned: number; total: number };
  lastEarnedAt: string | null;
};

export async function listLibraryTrophyProgress(
  sql: Sql,
  userId: string,
): Promise<LibraryTrophyGame[]> {
  const rows = await sql<any>`
    with trophy_games as (
      select
        gt.platform,
        gt.title_id,
        count(*)::int as total,
        count(*) filter (where gt.earned)::int as earned,
        round(
          100.0 * count(*) filter (where gt.earned) / nullif(count(*), 0),
          1
        )::float as percentage,
        count(*) filter (where gt.trophy_type = 'platinum' and gt.earned)::int as platinum_earned,
        count(*) filter (where gt.trophy_type = 'platinum')::int as platinum_total,
        count(*) filter (where gt.trophy_type = 'gold' and gt.earned)::int as gold_earned,
        count(*) filter (where gt.trophy_type = 'gold')::int as gold_total,
        count(*) filter (where gt.trophy_type = 'silver' and gt.earned)::int as silver_earned,
        count(*) filter (where gt.trophy_type = 'silver')::int as silver_total,
        count(*) filter (where gt.trophy_type = 'bronze' and gt.earned)::int as bronze_earned,
        count(*) filter (where gt.trophy_type = 'bronze')::int as bronze_total,
        max(gt.earned_at)::text as last_earned_at
      from game_trophies gt
      group by gt.platform, gt.title_id
    )
    select
      ge.id as game_id,
      ge.catalog_id,
      ge.title,
      ge.cover_url,
      ge.header_url,
      tg.platform,
      tg.title_id,
      tg.total,
      tg.earned,
      tg.percentage,
      tg.platinum_earned,
      tg.platinum_total,
      tg.gold_earned,
      tg.gold_total,
      tg.silver_earned,
      tg.silver_total,
      tg.bronze_earned,
      tg.bronze_total,
      tg.last_earned_at
    from trophy_games tg
    join lateral (
      select t.platform, t.title_id, t.name
      from playstation_titles t
      where t.platform = tg.platform
        and t.title_id = tg.title_id
        and t.is_game = true
      order by case t.region
        when 'IN' then 0
        when 'AS' then 1
        when 'EP' then 2
        when 'UP' then 3
        when 'JP' then 4
        when 'HP' then 5
        else 6
      end, t.region
      limit 1
    ) t on true
    join lateral (
      select ge.id, ge.catalog_id, ge.title, ge.cover_url, ge.header_url
      from game_entries ge
      where ge.user_id = ${userId}
        and regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g') =
            regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
      order by ge.updated_at desc
      limit 1
    ) ge on true
    order by tg.percentage desc, tg.last_earned_at desc nulls last, ge.title asc
  `;

  return rows.map((row: any) => ({
    gameId: row.game_id,
    catalogId: row.catalog_id,
    title: row.title,
    coverUrl: row.cover_url,
    headerUrl: row.header_url,
    platform: row.platform,
    titleId: row.title_id,
    total: Number(row.total),
    earned: Number(row.earned),
    percentage: Number(row.percentage ?? 0),
    platinum: { earned: Number(row.platinum_earned), total: Number(row.platinum_total) },
    gold: { earned: Number(row.gold_earned), total: Number(row.gold_total) },
    silver: { earned: Number(row.silver_earned), total: Number(row.silver_total) },
    bronze: { earned: Number(row.bronze_earned), total: Number(row.bronze_total) },
    lastEarnedAt: row.last_earned_at,
  }));
}

function summarizeTrophyGames(games: LibraryTrophyGame[]) {
  const summary = games.reduce(
    (acc, game) => {
      acc.total += game.total;
      acc.earned += game.earned;
      acc.platinum += game.platinum.earned;
      acc.gold += game.gold.earned;
      acc.silver += game.silver.earned;
      acc.bronze += game.bronze.earned;
      return acc;
    },
    { total: 0, earned: 0, platinum: 0, gold: 0, silver: 0, bronze: 0 },
  );

  return {
    ...summary,
    percentage: summary.total === 0 ? 0 : Number(((summary.earned / summary.total) * 100).toFixed(1)),
    games: games.length,
  };
}

export async function getTrophySummary(sql: Sql, userId: string) {
  return summarizeTrophyGames(await listLibraryTrophyProgress(sql, userId));
}

export { summarizeTrophyGames };
