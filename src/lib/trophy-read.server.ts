import type { Sql } from "./db.ts";
import type { CatalogDetails } from "./types.ts";
import { fetchCatalogDetails, titleKey } from "./catalog.server.ts";
import { parseWikiTitle, wikiCatalogId } from "./wikipedia.server.ts";

type Platform = "ps4" | "ps5";

type TrophyRow = {
  trophy_id: number;
  trophy_type: string | null;
  trophy_name: string | null;
  trophy_detail: string | null;
  trophy_icon_url: string | null;
  trophy_hidden: boolean | null;
  earned: boolean;
  earned_at: string | null;
};

type EntryIdentity = {
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
};

export type LibraryTrophyGame = {
  gameId: number;
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  platform: Platform;
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** Accept new opaque Wiki ids and all legacy percent-encoded/decoded forms. */
export function catalogIdVariants(catalogId: string): string[] {
  if (!catalogId.startsWith("wiki_")) return [catalogId];
  const title = parseWikiTitle(catalogId);
  if (!title) return [catalogId];

  const legacyEncoded = `wiki_${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const legacyDecoded = `wiki_${title.replace(/ /g, "_")}`;
  return uniqueStrings([
    wikiCatalogId(title),
    catalogId,
    legacyEncoded,
    legacyDecoded,
  ]);
}

export function canonicalCatalogId(catalogId: string): string {
  if (!catalogId.startsWith("wiki_")) return catalogId;
  const title = parseWikiTitle(catalogId);
  return title ? wikiCatalogId(title) : catalogId;
}

function typeRank(type: string | null): number {
  switch (type) {
    case "platinum":
      return 0;
    case "gold":
      return 1;
    case "silver":
      return 2;
    case "bronze":
      return 3;
    default:
      return 4;
  }
}

function sortTrophies(rows: TrophyRow[]): TrophyRow[] {
  return rows.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const type = typeRank(a.trophy_type) - typeRank(b.trophy_type);
    if (type !== 0) return type;
    const ad = a.earned_at ? Date.parse(a.earned_at) : 0;
    const bd = b.earned_at ? Date.parse(b.earned_at) : 0;
    if (a.earned && ad !== bd) return bd - ad;
    return a.trophy_id - b.trophy_id;
  });
}

function redact(row: TrophyRow): TrophyRow {
  if (row.trophy_hidden && !row.earned) {
    return {
      ...row,
      trophy_name: null,
      trophy_detail: null,
      trophy_icon_url: null,
    };
  }
  return row;
}

async function findEntry(
  sql: Sql,
  userId: string,
  catalogId: string,
  details: CatalogDetails | null,
): Promise<EntryIdentity | null> {
  const variants = catalogIdVariants(catalogId);
  const exact = await sql.query<EntryIdentity & { id: number }>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl"
       from game_entries
      where user_id = $1
        and catalog_id = any($2::text[])
      order by case when catalog_id = $3 then 0 else 1 end,
               updated_at desc, id desc
      limit 1`,
    [userId, variants, canonicalCatalogId(catalogId)],
  );
  if (exact[0]) return exact[0];

  if (!details?.title) return null;
  const key = titleKey(details.title);
  if (!key) return null;
  const byTitle = await sql.query<EntryIdentity & { id: number }>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl"
       from game_entries
      where user_id = $1
        and regexp_replace(lower(title), '[^a-z0-9]+', '', 'g') = $2
      order by updated_at desc, id desc
      limit 1`,
    [userId, key.replace(/[^a-z0-9]+/g, "")],
  );
  return byTitle[0] ?? null;
}

async function resolveDetails(catalogId: string): Promise<CatalogDetails | null> {
  try {
    return await fetchCatalogDetails(catalogId);
  } catch {
    return null;
  }
}

async function findPlaystationTitle(
  sql: Sql,
  title: string,
): Promise<{ platform: Platform; titleId: string } | null> {
  const normalized = titleKey(title).replace(/[^a-z0-9]+/g, "");
  if (!normalized) return null;

  const rows = await sql.query<{
    platform: Platform;
    title_id: string;
  }>(
    `select distinct t.platform, t.title_id
       from playstation_titles t
       where t.is_game = true
         and regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g') = $1
         and exists (
           select 1 from game_trophies gt
            where gt.platform = t.platform
              and gt.title_id = t.title_id
         )
       order by case t.platform when 'ps5' then 0 when 'ps4' then 1 else 2 end,
                t.region
       limit 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

async function readTrophies(
  sql: Sql,
  platform: Platform,
  titleId: string,
): Promise<TrophyRow[]> {
  // DISTINCT ON gives one authoritative row per platform/title/trophy id,
  // preferring earned state and the newest earned timestamp. This protects
  // both overview totals and detail cards from duplicate sync/catalog rows.
  const rows = await sql.query<TrophyRow>(
    `select distinct on (platform, title_id, trophy_id)
            trophy_id,
            trophy_type,
            trophy_name,
            trophy_detail,
            trophy_icon_url,
            trophy_hidden,
            earned,
            earned_at::text as earned_at
       from game_trophies
      where platform = $1
        and title_id = $2
      order by platform, title_id, trophy_id,
               earned desc,
               earned_at desc nulls last,
               id desc`,
    [platform, titleId],
  );
  return sortTrophies(rows.map(redact));
}

function counts(rows: TrophyRow[], type: string) {
  const all = rows.filter((row) => row.trophy_type === type);
  return {
    earned: all.filter((row) => row.earned).length,
    total: all.length,
  };
}

export async function getGameTrophyProgressForCatalog(
  sql: Sql,
  userId: string,
  catalogId: string,
) {
  const details = await resolveDetails(catalogId);
  const entry = await findEntry(sql, userId, catalogId, details);
  if (!entry) return { found: false as const };

  const identity =
    (await findPlaystationTitle(sql, entry.title)) ??
    (details?.title ? await findPlaystationTitle(sql, details.title) : null);
  if (!identity) return { found: false as const };

  const trophies = await readTrophies(sql, identity.platform, identity.titleId);
  if (!trophies.length) return { found: false as const };

  const earned = trophies.filter((row) => row.earned).length;
  const total = trophies.length;
  return {
    found: true as const,
    catalogId: canonicalCatalogId(entry.catalogId),
    titleId: identity.titleId,
    titleName: entry.title,
    coverUrl: entry.coverUrl,
    headerUrl: entry.headerUrl,
    platform: identity.platform,
    total,
    earned,
    percentage: Number(((earned / total) * 100).toFixed(1)),
    platinum: counts(trophies, "platinum"),
    gold: counts(trophies, "gold"),
    silver: counts(trophies, "silver"),
    bronze: counts(trophies, "bronze"),
    trophies,
  };
}

export async function listLibraryTrophyProgressDeduped(
  sql: Sql,
  userId: string,
): Promise<LibraryTrophyGame[]> {
  const rows = await sql.query<{
    game_id: number;
    catalog_id: string;
    title: string;
    cover_url: string | null;
    header_url: string | null;
    platform: Platform;
    title_id: string;
    total: number;
    earned: number;
    platinum_earned: number;
    platinum_total: number;
    gold_earned: number;
    gold_total: number;
    silver_earned: number;
    silver_total: number;
    bronze_earned: number;
    bronze_total: number;
    last_earned_at: string | null;
  }>(
    `with dedup as (
       select distinct on (platform, title_id, trophy_id) *
         from game_trophies
        order by platform, title_id, trophy_id,
                 earned desc,
                 earned_at desc nulls last,
                 id desc
     ), trophy_games as (
       select
         platform,
         title_id,
         count(*)::int as total,
         count(*) filter (where earned)::int as earned,
         count(*) filter (where trophy_type = 'platinum' and earned)::int as platinum_earned,
         count(*) filter (where trophy_type = 'platinum')::int as platinum_total,
         count(*) filter (where trophy_type = 'gold' and earned)::int as gold_earned,
         count(*) filter (where trophy_type = 'gold')::int as gold_total,
         count(*) filter (where trophy_type = 'silver' and earned)::int as silver_earned,
         count(*) filter (where trophy_type = 'silver')::int as silver_total,
         count(*) filter (where trophy_type = 'bronze' and earned)::int as bronze_earned,
         count(*) filter (where trophy_type = 'bronze')::int as bronze_total,
         max(earned_at)::text as last_earned_at
       from dedup
      group by platform, title_id
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
            when 'IN' then 0 when 'AS' then 1 when 'EP' then 2
            when 'UP' then 3 when 'JP' then 4 when 'HP' then 5 else 6
          end, t.region
          limit 1
       ) t on true
       join lateral (
         select ge.id, ge.catalog_id, ge.title, ge.cover_url, ge.header_url
           from game_entries ge
          where ge.user_id = $1
            and regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g') =
                regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g')
          order by ge.updated_at desc, ge.id desc
          limit 1
       ) ge on true
       order by tg.earned::float / nullif(tg.total, 0) desc,
                tg.last_earned_at desc nulls last,
                ge.title asc`,
    [userId],
  );

  return rows.map((row) => ({
    gameId: row.game_id,
    catalogId: canonicalCatalogId(row.catalog_id),
    title: row.title,
    coverUrl: row.cover_url,
    headerUrl: row.header_url,
    platform: row.platform,
    titleId: row.title_id,
    total: Number(row.total),
    earned: Number(row.earned),
    percentage: row.total === 0 ? 0 : Number(((row.earned / row.total) * 100).toFixed(1)),
    platinum: { earned: Number(row.platinum_earned), total: Number(row.platinum_total) },
    gold: { earned: Number(row.gold_earned), total: Number(row.gold_total) },
    silver: { earned: Number(row.silver_earned), total: Number(row.silver_total) },
    bronze: { earned: Number(row.bronze_earned), total: Number(row.bronze_total) },
    lastEarnedAt: row.last_earned_at,
  }));
}
