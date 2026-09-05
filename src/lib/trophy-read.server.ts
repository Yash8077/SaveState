import type { Sql } from "./db.ts";
import type { CatalogDetails, GameEntry } from "./types.ts";
import { fetchCatalogDetails, titleKey } from "./catalog.server.ts";
import { parseWikiTitle, wikiCatalogId } from "./wikipedia.server.ts";

type Platform = "ps4" | "ps5";

type TrophyRow = {
  trophy_title_id: string;
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
  id: number;
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  platforms: unknown;
};

type PlaystationIdentity = {
  platform: Platform;
  titleId: string;
};

export type LibraryTrophyGame = {
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
  return [...rows].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const type = typeRank(a.trophy_type) - typeRank(b.trophy_type);
    if (type !== 0) return type;
    const ad = a.earned_at ? Date.parse(a.earned_at) : 0;
    const bd = b.earned_at ? Date.parse(b.earned_at) : 0;
    if (a.earned && ad !== bd) return bd - ad;
    const setCompare = a.trophy_title_id.localeCompare(b.trophy_title_id);
    if (setCompare !== 0) return setCompare;
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

function titlePlatformPreference(entry: EntryIdentity): Platform[] {
  const raw = Array.isArray(entry.platforms)
    ? entry.platforms.filter((v): v is string => typeof v === "string")
    : [];
  const hasPs5 = raw.some((value) => /\bps5\b/i.test(value));
  const hasPs4 = raw.some((value) => /\bps4\b/i.test(value));
  return [
    ...(hasPs5 ? (["ps5"] as const) : []),
    ...(hasPs4 ? (["ps4"] as const) : []),
    ...(!hasPs5 && !hasPs4 ? (["ps5", "ps4"] as const) : []),
  ];
}

function collectionLike(details: CatalogDetails | null, title: string): boolean {
  if (details?.gameType === 3 || details?.gameType === 13) return true;
  return /\b(collection|trilogy|duology|anthology|bundle|compilation|pack|chronicles|saga|legacy collection)\b/i.test(title);
}

/**
 * IGDB collection relations are exposed by catalog.server as the `series`
 * rail. For a bundle/collection we use those member titles as PlayStation
 * identity candidates, rather than assuming the collection has one trophy set.
 */
function collectionMemberTitles(details: CatalogDetails | null): string[] {
  const series = details?.related?.find((rail) => rail.id === "series");
  if (!series) return [];
  return series.games.map((game) => game.title).filter(Boolean);
}

async function findEntry(
  sql: Sql,
  userId: string,
  catalogId: string,
  details: CatalogDetails | null,
): Promise<EntryIdentity | null> {
  const variants = catalogIdVariants(catalogId);
  const exact = await sql.query<EntryIdentity>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl", platforms
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
  const key = titleKey(details.title).replace(/[^a-z0-9]+/g, "");
  if (!key) return null;

  const byTitle = await sql.query<EntryIdentity>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl", platforms
       from game_entries
      where user_id = $1
        and regexp_replace(lower(title), '[^a-z0-9]+', '', 'g') = $2
      order by updated_at desc, id desc
      limit 1`,
    [userId, key],
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

async function findPlaystationIdentities(
  sql: Sql,
  titles: string[],
): Promise<PlaystationIdentity[]> {
  const normalized = uniqueStrings(
    titles
      .map((title) => titleKey(title).replace(/[^a-z0-9]+/g, ""))
      .filter(Boolean),
  );
  if (!normalized.length) return [];

  const rows = await sql.query<PlaystationIdentity>(
    `select distinct t.platform, t.title_id as "titleId"
       from playstation_titles t
      where t.is_game = true
        and regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g') = any($1::text[])
        and exists (
          select 1
            from game_trophies gt
           where gt.platform = t.platform
             and gt.title_id = t.title_id
        )
      order by case t.platform when 'ps5' then 0 when 'ps4' then 1 else 2 end,
               t.title_id`,
    [normalized],
  );

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.platform}:${row.titleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function choosePlatformIdentities(
  identities: PlaystationIdentity[],
  preferred: Platform[],
): PlaystationIdentity[] {
  for (const platform of preferred) {
    const matches = identities.filter((identity) => identity.platform === platform);
    if (matches.length) return matches;
  }
  return [];
}

async function resolvePlaystationIdentities(
  sql: Sql,
  entry: EntryIdentity,
  details: CatalogDetails | null,
): Promise<PlaystationIdentity[]> {
  const exactTitles = uniqueStrings([entry.title, details?.title ?? ""]);
  let identities = await findPlaystationIdentities(sql, exactTitles);

  const preferred = titlePlatformPreference(entry);
  identities = choosePlatformIdentities(identities, preferred);

  const isCollection = collectionLike(details, entry.title);
  const memberTitles = isCollection ? collectionMemberTitles(details) : [];

  // A collection may have a PlayStation row for the collection itself plus
  // separate rows for each child title. Include both, but only on one
  // preferred platform.
  if (isCollection && memberTitles.length) {
    const memberIdentities = choosePlatformIdentities(
      await findPlaystationIdentities(sql, memberTitles),
      preferred,
    );
    const merged = [...identities, ...memberIdentities];
    const seen = new Set<string>();
    identities = merged.filter((identity) => {
      const key = `${identity.platform}:${identity.titleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // If the collection has no exact/child match, a second pass using the
  // collection's member titles is intentionally the only fuzzy fallback.
  // This avoids accidentally merging ordinary sequels/franchise members.
  if (!identities.length && memberTitles.length) {
    identities = choosePlatformIdentities(
      await findPlaystationIdentities(sql, memberTitles),
      preferred,
    );
  }

  return identities;
}

async function readTrophies(
  sql: Sql,
  identities: PlaystationIdentity[],
): Promise<TrophyRow[]> {
  if (!identities.length) return [];

  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  for (const identity of identities) {
    clauses.push(`(platform = $${index} and title_id = $${index + 1})`);
    values.push(identity.platform, identity.titleId);
    index += 2;
  }

  const rows = await sql.query<TrophyRow>(
    `select distinct on (platform, title_id, trophy_title_id, trophy_id)
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
      where ${clauses.join(" or ")}
      order by platform, title_id, trophy_title_id, trophy_id,
               earned desc,
               earned_at desc nulls last,
               id desc`,
    values,
  );

  return sortTrophies(rows.map(redact));
}

function countTypes(rows: TrophyRow[], type: string) {
  const all = rows.filter((row) => row.trophy_type === type);
  return {
    earned: all.filter((row) => row.earned).length,
    total: all.length,
  };
}

async function buildGameResult(
  sql: Sql,
  entry: EntryIdentity,
  details: CatalogDetails | null,
): Promise<LibraryTrophyGame | null> {
  const identities = await resolvePlaystationIdentities(sql, entry, details);
  if (!identities.length) return null;

  const trophies = await readTrophies(sql, identities);
  if (!trophies.length) return null;

  const earned = trophies.filter((row) => row.earned).length;
  const total = trophies.length;
  const titleIds = uniqueStrings(identities.map((identity) => identity.titleId));
  const primary = identities[0];

  return {
    gameId: entry.id,
    catalogId: canonicalCatalogId(entry.catalogId),
    title: entry.title,
    coverUrl: entry.coverUrl,
    headerUrl: entry.headerUrl,
    platform: primary.platform,
    titleId: primary.titleId,
    titleIds,
    total,
    earned,
    percentage: Number(((earned / total) * 100).toFixed(1)),
    platinum: countTypes(trophies, "platinum"),
    gold: countTypes(trophies, "gold"),
    silver: countTypes(trophies, "silver"),
    bronze: countTypes(trophies, "bronze"),
    lastEarnedAt: trophies.find((row) => row.earned)?.earned_at ?? null,
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

  const result = await buildGameResult(sql, entry, details);
  if (!result) return { found: false as const };

  const identities = await resolvePlaystationIdentities(sql, entry, details);
  const trophies = await readTrophies(sql, identities);
  if (!trophies.length) return { found: false as const };

  return {
    found: true as const,
    catalogId: canonicalCatalogId(entry.catalogId),
    titleId: result.titleId,
    titleIds: result.titleIds,
    titleName: entry.title,
    coverUrl: entry.coverUrl,
    headerUrl: entry.headerUrl,
    platform: result.platform,
    total: result.total,
    earned: result.earned,
    percentage: result.percentage,
    platinum: result.platinum,
    gold: result.gold,
    silver: result.silver,
    bronze: result.bronze,
    trophies,
  };
}

export async function listLibraryTrophyProgressDeduped(
  sql: Sql,
  userId: string,
): Promise<LibraryTrophyGame[]> {
  // Fast path: aggregate every exact-name PlayStation trophy identity. This
  // handles multiple regions and collection title IDs without one query per
  // library entry.
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
    identity_count: number;
  }>(
    `with dedup as (
       select distinct on (platform, title_id, trophy_title_id, trophy_id) *
         from game_trophies
        order by platform, title_id, trophy_title_id, trophy_id,
                 earned desc,
                 earned_at desc nulls last,
                 id desc
     ),
     matched as (
       select
         ge.id as game_id,
         ge.catalog_id,
         ge.title,
         ge.cover_url,
         ge.header_url,
         d.platform,
         d.title_id,
         d.trophy_title_id,
         d.trophy_id,
         d.trophy_type,
         d.earned,
         d.earned_at
       from game_entries ge
       join playstation_titles t
         on t.is_game = true
        and regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g') =
            regexp_replace(lower(ge.title), '[^a-z0-9]+', '', 'g')
       join dedup d
         on d.platform = t.platform
        and d.title_id = t.title_id
       where ge.user_id = $1
     )
     select
       game_id,
       catalog_id,
       title,
       cover_url,
       header_url,
       platform,
       min(title_id) as title_id,
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
       max(earned_at)::text as last_earned_at,
       count(distinct title_id)::int as identity_count
     from matched
     group by game_id, catalog_id, title, cover_url, header_url, platform
     order by
       case when count(*) = 0 then 1 else 0 end,
       count(*) filter (where earned)::float / nullif(count(*), 0) desc,
       max(earned_at) desc nulls last,
       title asc`,
    [userId],
  );

  const results = rows.map((row) => ({
    gameId: row.game_id,
    catalogId: canonicalCatalogId(row.catalog_id),
    title: row.title,
    coverUrl: row.cover_url,
    headerUrl: row.header_url,
    platform: row.platform,
    titleId: row.title_id,
    titleIds: [row.title_id],
    total: Number(row.total),
    earned: Number(row.earned),
    percentage:
      row.total === 0 ? 0 : Number(((row.earned / row.total) * 100).toFixed(1)),
    platinum: {
      earned: Number(row.platinum_earned),
      total: Number(row.platinum_total),
    },
    gold: {
      earned: Number(row.gold_earned),
      total: Number(row.gold_total),
    },
    silver: {
      earned: Number(row.silver_earned),
      total: Number(row.silver_total),
    },
    bronze: {
      earned: Number(row.bronze_earned),
      total: Number(row.bronze_total),
    },
    lastEarnedAt: row.last_earned_at,
    identityCount: Number(row.identity_count),
  }));

  // Collection fallback: only expand likely collection entries that resolved
  // to no more than one PlayStation identity in the fast path. This keeps the
  // overview cheap for ordinary games but supports bundles whose member games
  // have different PlayStation names.
  const library = await sql<EntryIdentity & { id: number }>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl", platforms
       from game_entries
      where user_id = $1`,
    [userId],
  );

  const resultByGame = new Map(results.map((row) => [row.gameId, row]));
  const candidates = library.filter((entry) => {
    if (!collectionLike(null, entry.title)) return false;
    const existing = resultByGame.get(entry.id);
    return !existing || existing.identityCount <= 1;
  });

  const expanded = await mapWithConcurrency(candidates, 6, async (entry) => {
    const details = await resolveDetails(entry.catalogId);
    if (!collectionLike(details, entry.title)) return null;
    return buildGameResult(sql, entry, details);
  });

  for (const expandedRow of expanded) {
    if (expandedRow && expandedRow.total > 0) {
      resultByGame.set(expandedRow.gameId, expandedRow);
    }
  }

  return [...resultByGame.values()]
    .map(({ identityCount: _identityCount, ...row }) => row)
    .sort((a, b) => {
      const ar = a.total ? a.earned / a.total : 0;
      const br = b.total ? b.earned / b.total : 0;
      return br - ar ||
        (b.lastEarnedAt ?? "").localeCompare(a.lastEarnedAt ?? "") ||
        a.title.localeCompare(b.title);
    });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return output;
}
