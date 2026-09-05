import type { Sql } from "./db.ts";
import type { CatalogDetails } from "./types.ts";
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
  if (variants.length) {
    const placeholders = variants.map((_, i) => `$${i + 2}`).join(', ');
    const exact = await sql.query<EntryIdentity>(
      `select id, catalog_id as "catalogId", title,
              cover_url as "coverUrl", header_url as "headerUrl", platforms
         from game_entries
        where user_id = $1
          and catalog_id in (${placeholders})
        order by case when catalog_id = $2 then 0 else 1 end,
                 updated_at desc, id desc
        limit 1`,
      [userId, ...variants],
    );
    if (exact[0]) return exact[0];
  }

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

function normalizedTitle(title: string): string {
  return titleKey(title).replace(/[^a-z0-9]+/g, "");
}

function meaningfulTitleTokens(title: string): string[] {
  const stop = new Set([
    "the", "of", "and", "a", "an", "for", "to", "in", "on", "at",
    "game", "video", "edition", "bundle", "collection", "compilation",
    "pack", "complete", "definitive", "deluxe", "ultimate", "remastered",
    "remaster", "remake", "original", "version", "digital", "directors",
    "director", "cut", "trilogy", "duology", "anthology", "set", "vol",
  ]);
  const clean = title
    .replace(/[’']s\b/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return uniqueStrings(
    clean
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stop.has(token)),
  );
}

function matchScore(sourceTitle: string, candidateTitle: string): number {
  const source = normalizedTitle(sourceTitle);
  const candidate = normalizedTitle(candidateTitle);
  if (!source || !candidate) return 0;
  if (source === candidate) return 1;

  const sourceTokens = meaningfulTitleTokens(sourceTitle);
  const candidateTokens = new Set(meaningfulTitleTokens(candidateTitle));
  if (!sourceTokens.length || !candidateTokens.size) return 0;

  const overlap = sourceTokens.filter((token) => candidateTokens.has(token)).length;
  if (overlap < Math.min(2, sourceTokens.length)) return 0;
  const coverage = overlap / sourceTokens.length;
  const precision = overlap / candidateTokens.size;
  if (coverage < 0.5) return 0;
  return 0.7 * coverage + 0.3 * precision;
}

async function findPlaystationIdentities(
  sql: Sql,
  titles: string[],
): Promise<PlaystationIdentity[]> {
  const normalized = uniqueStrings(
    titles.map(normalizedTitle).filter(Boolean),
  );
  if (!normalized.length) return [];

  const clauses: string[] = [];
  const values: unknown[] = [];
  for (const value of normalized) {
    const n = values.length + 1;
    clauses.push(`regexp_replace(lower(t.name), '[^a-z0-9]+', '', 'g') = $${n}`);
    values.push(value);
  }

  const rows = await sql.query<PlaystationIdentity>(
    `select t.platform, t.title_id as "titleId"
       from playstation_titles t
      where t.is_game = true
        and (${clauses.join(" or ")})
        and (
          exists (
            select 1
              from game_trophies gt
             where gt.platform = t.platform
               and gt.title_id = t.title_id
          )
          or exists (
            select 1
              from trophy_title_game_map gm
             where gm.platform = t.platform
               and gm.title_id = t.title_id
          )
        )
      order by case t.platform when 'ps5' then 0 when 'ps4' then 1 else 2 end,
               t.title_id`,
    values,
  );

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.platform}:${row.titleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findPlaystationCandidates(
  sql: Sql,
  titles: string[],
  platform: Platform,
): Promise<Array<PlaystationIdentity & { name: string }>> {
  const tokens = uniqueStrings(
    titles
      .flatMap(meaningfulTitleTokens)
      .sort((a, b) => b.length - a.length)
      .slice(0, 12),
  );
  if (!tokens.length) return [];

  const clauses: string[] = [];
  const values: unknown[] = [platform];
  for (const token of tokens) {
    const n = values.length + 1;
    clauses.push(`lower(t.name) like $${n}`);
    values.push(`%${token}%`);
  }

  return sql.query<PlaystationIdentity & { name: string }>(
    `select t.platform, t.title_id as "titleId", t.name
       from playstation_titles t
      where t.is_game = true
        and t.platform = $1
        and (${clauses.join(" or ")})
        and (
          exists (
            select 1
              from game_trophies gt
             where gt.platform = t.platform
               and gt.title_id = t.title_id
          )
          or exists (
            select 1
              from trophy_title_game_map gm
             where gm.platform = t.platform
               and gm.title_id = t.title_id
          )
        )
      order by t.title_id`,
    values,
  );
}

async function resolveMemberIdentities(
  sql: Sql,
  memberTitles: string[],
  preferred: Platform[],
): Promise<PlaystationIdentity[]> {
  const selected: PlaystationIdentity[] = [];
  const used = new Set<string>();

  for (const platform of preferred) {
    const unmatched: string[] = [];

    // Resolve each member independently first. This prevents one member's
    // exact title match from being incorrectly assigned to another member.
    for (const member of memberTitles) {
      const exact = await findPlaystationIdentities(sql, [member]);
      const match = exact.find(
        (identity) =>
          identity.platform === platform &&
          !used.has(`${identity.platform}:${identity.titleId}`),
      );
      if (!match) {
        unmatched.push(member);
        continue;
      }
      selected.push(match);
      used.add(`${match.platform}:${match.titleId}`);
    }

    // Exact matching may fail when PlayStation uses a slightly different
    // name (subtitle/remaster/edition suffix). Fuzzy matching is restricted
    // to the unresolved members of a catalog collection.
    if (unmatched.length) {
      const candidates = await findPlaystationCandidates(
        sql,
        unmatched,
        platform,
      );
      const remaining = candidates.filter(
        (candidate) => !used.has(`${candidate.platform}:${candidate.titleId}`),
      );

      for (const member of unmatched) {
        let bestIndex = -1;
        let bestScore = 0;
        for (let i = 0; i < remaining.length; i++) {
          const candidate = remaining[i]!;
          const score = matchScore(member, candidate.name);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
        if (bestIndex < 0 || bestScore < 0.55) continue;
        const [best] = remaining.splice(bestIndex, 1);
        if (!best) continue;
        const key = `${best.platform}:${best.titleId}`;
        if (used.has(key)) continue;
        selected.push({ platform: best.platform, titleId: best.titleId });
        used.add(key);
      }
    }

    if (selected.length) return selected;
  }

  return [];
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

const TROPHY_IDENTITY_RESOLVER_VERSION = 2;

async function loadStoredIdentities(
  sql: Sql,
  catalogIds: string[],
): Promise<PlaystationIdentity[]> {
  const ids = uniqueStrings(catalogIds.map(canonicalCatalogId));
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await sql.query<PlaystationIdentity>(
    `select platform, title_id as "titleId"
       from catalog_trophy_identities
      where resolver_version = ${TROPHY_IDENTITY_RESOLVER_VERSION}
        and catalog_id in (${placeholders})
      order by platform, title_id`,
    ids,
  );
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.platform}:${row.titleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function persistIdentities(
  sql: Sql,
  catalogId: string,
  identities: PlaystationIdentity[],
) {
  const canonical = canonicalCatalogId(catalogId);
  await sql.query(
    `delete from catalog_trophy_identities
      where catalog_id = $1`,
    [canonical],
  );
  for (const identity of identities) {
    await sql.query(
      `insert into catalog_trophy_identities (
         catalog_id, platform, title_id, resolver_version, updated_at
       ) values ($1, $2, $3, ${TROPHY_IDENTITY_RESOLVER_VERSION}, now())
       on conflict (catalog_id, platform, title_id)
       do update set resolver_version = excluded.resolver_version,
                     updated_at = now()`,
      [canonical, identity.platform, identity.titleId],
    );
  }
}

async function resolvePlaystationIdentities(
  sql: Sql,
  entry: EntryIdentity,
  details: CatalogDetails | null,
): Promise<PlaystationIdentity[]> {
  const stored = await loadStoredIdentities(sql, catalogIdVariants(entry.catalogId));
  const preferred = titlePlatformPreference(entry);
  if (stored.length) {
    const selected = choosePlatformIdentities(stored, preferred);
    if (selected.length) return selected;
  }

  const exactTitles = uniqueStrings([entry.title, details?.title ?? ""]);
  const exact = choosePlatformIdentities(
    await findPlaystationIdentities(sql, exactTitles),
    preferred,
  );

  const isCollection = collectionLike(details, entry.title);
  let resolvedDetails = details;
  let identities = exact;

  if (isCollection || !identities.length) {
    if (!resolvedDetails) resolvedDetails = await resolveDetails(entry.catalogId);
    const memberTitles = collectionMemberTitles(resolvedDetails);
    if (isCollection && memberTitles.length) {
      const memberIdentities = await resolveMemberIdentities(
        sql,
        memberTitles,
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
  }

  const selected = choosePlatformIdentities(identities, preferred);
  if (selected.length) {
    await persistIdentities(sql, entry.catalogId, selected);
  }
  return selected;
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
    lastEarnedAt:
      trophies.reduce<string | null>((latest, row) => {
        if (!row.earned_at) return latest;
        if (!latest) return row.earned_at;
        return Date.parse(row.earned_at) > Date.parse(latest)
          ? row.earned_at
          : latest;
      }, null),
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
  const libraryRows = await sql.query<EntryIdentity>(
    `select id, catalog_id as "catalogId", title,
            cover_url as "coverUrl", header_url as "headerUrl", platforms
       from game_entries
      where user_id = $1
      order by updated_at desc, id desc`,
    [userId],
  );
  const library = libraryRows as EntryIdentity[];

  const results = await mapWithConcurrency(library, 4, async (entry: EntryIdentity) => {
    try {
      return await buildGameResult(sql, entry, null);
    } catch {
      return null;
    }
  });

  return results
    .filter((row): row is LibraryTrophyGame => Boolean(row))
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
