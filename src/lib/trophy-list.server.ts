import type { Sql } from "./db.ts";
type Platform = "ps4" | "ps5";

export type LibraryTrophyGameFast = {
  gameId: number;
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  platform: Platform;
  titleId: string;
  titleIds: string[];
  total: number;
  earned: number;
  percentage: number;
  platinum: { earned: number; total: number };
  gold: { earned: number; total: number };
  silver: { earned: number; total: number };
  bronze: { earned: number; total: number };
  lastEarnedAt: string | null;
};

type TrophyListRow = {
  game_id: number;
  catalog_id: string;
  title: string;
  cover_url: string | null;
  header_url: string | null;
  platform: Platform;
  title_id: string;
  trophy_title_id: string;
  trophy_id: number;
  trophy_type: string | null;
  trophy_hidden: boolean | null;
  earned: boolean;
  earned_at: string | null;
};

function redactHidden(row: TrophyListRow) {
  // The overview only needs counts, so hidden trophy metadata never leaves
  // the server from this endpoint. The detail endpoint remains responsible
  // for returning the individual trophy payload with the existing redaction.
  return row;
}

function countType(
  rows: TrophyListRow[],
  type: string,
): { earned: number; total: number } {
  const matches = rows.filter((row) => row.trophy_type === type);
  return {
    earned: matches.filter((row) => row.earned).length,
    total: matches.length,
  };
}

/**
 * Fast trophy overview query.
 *
 * The overview is intentionally driven by game_trophies, but is constrained
 * to identities that belong to the authenticated user's library. Persisted
 * catalog_trophy_identities are preferred; a DB-only title match is used as
 * a fallback for older library rows that have not been persisted yet.
 *
 * No catalog/Wikipedia/IGDB/network resolution happens on this hot path and
 * the trophy data is fetched in one SQL request instead of one resolver per
 * library game.
 */
export async function listLibraryTrophyProgressFast(
  sql: Sql,
  userId: string,
): Promise<LibraryTrophyGameFast[]> {
  const rows = await sql<TrophyListRow>`
    with library as (
      select
        ge.id,
        ge.catalog_id,
        ge.title,
        ge.cover_url,
        ge.header_url
      from game_entries ge
      where ge.user_id = ${userId}
    ),
    persisted_identities as (
      select distinct
        l.id as game_id,
        l.catalog_id,
        l.title,
        l.cover_url,
        l.header_url,
        ci.platform,
        ci.title_id
      from library l
      join catalog_trophy_identities ci
        on ci.catalog_id = l.catalog_id
       and ci.resolver_version = 2
    ),
    fallback_identities as (
      select distinct
        l.id as game_id,
        l.catalog_id,
        l.title,
        l.cover_url,
        l.header_url,
        pt.platform,
        pt.title_id
      from library l
      join playstation_titles pt
        on pt.is_game = true
       and regexp_replace(lower(pt.name), '[^a-z0-9]+', '', 'g') =
           regexp_replace(lower(l.title), '[^a-z0-9]+', '', 'g')
      where not exists (
        select 1
        from catalog_trophy_identities ci
        where ci.catalog_id = l.catalog_id
          and ci.resolver_version = 2
      )
    ),
    identities as (
      select * from persisted_identities
      union
      select * from fallback_identities
    ),
    distinct_trophies as (
      select distinct on (
        i.game_id,
        gt.platform,
        gt.title_id,
        gt.trophy_title_id,
        gt.trophy_id
      )
        i.game_id,
        i.catalog_id,
        i.title,
        i.cover_url,
        i.header_url,
        gt.platform,
        gt.title_id,
        gt.trophy_title_id,
        gt.trophy_id,
        gt.trophy_type,
        gt.trophy_hidden,
        gt.earned,
        gt.earned_at::text as earned_at
      from identities i
      join game_trophies gt
        on gt.platform = i.platform
       and gt.title_id = i.title_id
      order by
        i.game_id,
        gt.platform,
        gt.title_id,
        gt.trophy_title_id,
        gt.trophy_id,
        gt.earned desc,
        gt.earned_at desc nulls last,
        gt.id desc
    )
    select *
    from distinct_trophies
    order by game_id, platform, title_id, trophy_title_id, trophy_id
  `;

  const grouped = new Map<number, TrophyListRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.game_id);
    if (bucket) bucket.push(redactHidden(row));
    else grouped.set(row.game_id, [redactHidden(row)]);
  }

  const games: LibraryTrophyGameFast[] = [];

  for (const trophyRows of grouped.values()) {
    const first = trophyRows[0]!;
    const titleIds = [...new Set(trophyRows.map((row) => row.title_id))];
    const primary = trophyRows.find((row) => row.platform === "ps5") ?? first;
    const total = trophyRows.length;
    const earned = trophyRows.filter((row) => row.earned).length;
    const lastEarnedAt = trophyRows.reduce<string | null>((latest, row) => {
      if (!row.earned || !row.earned_at) return latest;
      if (!latest) return row.earned_at;
      return Date.parse(row.earned_at) > Date.parse(latest)
        ? row.earned_at
        : latest;
    }, null);

    games.push({
      gameId: first.game_id,
      catalogId: first.catalog_id,
      title: first.title,
      coverUrl: first.cover_url,
      headerUrl: first.header_url,
      platform: primary.platform,
      titleId: primary.title_id,
      titleIds,
      total,
      earned,
      percentage: total === 0 ? 0 : Number(((earned / total) * 100).toFixed(1)),
      platinum: countType(trophyRows, "platinum"),
      gold: countType(trophyRows, "gold"),
      silver: countType(trophyRows, "silver"),
      bronze: countType(trophyRows, "bronze"),
      lastEarnedAt,
    });
  }

  return games.sort((a, b) => {
    const ar = a.total ? a.earned / a.total : 0;
    const br = b.total ? b.earned / b.total : 0;
    return br - ar ||
      (b.lastEarnedAt ?? "").localeCompare(a.lastEarnedAt ?? "") ||
      a.title.localeCompare(b.title);
  });
}
