import type { Sql } from "./db";

const SOURCES = [
  { platform: "ps5", url: "https://raw.githubusercontent.com/andshrew/PlayStation-Titles/main/PS5_Titles.tsv" },
  { platform: "ps4", url: "https://raw.githubusercontent.com/andshrew/PlayStation-Titles/main/PS4_Titles.tsv" },
] as const;

const NON_GAME_NAME_PATTERNS = [
  /\bdemo\b/i,
  /\bsoundtrack\b/i,
  /\b(?:digital\s+)?(?:artbook|art\s*book)\b/i,
  /\b(?:original\s+)?soundtrack\b/i,
  /\b(?:season\s+pass|expansion\s+pass)\b/i,
  /\b(?:dlc|add[- ]?on|expansion\s+pass)\b/i,
  /\b(?:entitlement|patch|test|submission|beta)\b/i,
  /\b(?:music\s+album)\b/i,
  /\bdigital\s+(?:comic|book)\b/i,
];

const NON_GAME_EXACT_NAMES = new Set([
  "youtube",
  "netflix",
  "spotify",
  "twitch",
  "share factory studio",
  "media player",
  "playstation store",
  "playstation plus",
]);

export type PlayStationTitleRow = {
  platform: "ps4" | "ps5";
  titleId: string;
  conceptId: number | null;
  name: string;
  contentId: string | null;
  region: string;
  publisherId: string | null;
  isGame: boolean;
};

export function normalizePlayStationTitleId(value: string): string {
  return value.trim().toUpperCase().replace(/_00$/, "");
}

function isGameTitle(name: string, titleId: string, publisherId: string): boolean {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName || NON_GAME_EXACT_NAMES.has(normalizedName)) return false;
  if (/^NPXS\d+$/i.test(titleId)) return false;
  if (NON_GAME_NAME_PATTERNS.some((pattern) => pattern.test(name))) return false;
  if (/^PXG\d/i.test(name) || /\b(?:dev|debug)\b/i.test(name)) return false;
  if (/^IP9100$/i.test(publisherId) && /studio|share factory/i.test(name)) return false;
  return true;
}

function parseTsv(text: string, platform: "ps4" | "ps5"): PlayStationTitleRow[] {
  const rows: PlayStationTitleRow[] = [];
  const seen = new Map<string, PlayStationTitleRow>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!lines.length) return rows;

  for (const rawLine of lines.slice(1)) {
    if (!rawLine.trim()) continue;
    const columns = rawLine.split("\t");
    if (columns.length < 6) continue;

    const titleId = normalizePlayStationTitleId(columns[0] ?? "");
    const name = (columns[2] ?? "").trim();
    const region = (columns[4] ?? "").trim().toUpperCase();
    const publisherId = (columns[5] ?? "").trim() || null;
    if (!titleId || !name) continue;

    const conceptRaw = (columns[1] ?? "").trim();
    const conceptId = /^\d+$/.test(conceptRaw) ? Number(conceptRaw) : null;
    const row: PlayStationTitleRow = {
      platform,
      titleId,
      conceptId,
      name,
      contentId: (columns[3] ?? "").trim() || null,
      region,
      publisherId,
      isGame: isGameTitle(name, titleId, publisherId ?? ""),
    };

    const key = `${platform}|${titleId}|${region}`;
    const previous = seen.get(key);
    if (!previous || (!previous.isGame && row.isGame)) seen.set(key, row);
  }

  rows.push(...seen.values());
  return rows;
}

async function fetchSource(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/tab-separated-values,text/plain;q=0.9,*/*;q=0.1" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PlayStation title source returned HTTP ${response.status}`);
  return response.text();
}

async function upsertRows(sql: Sql, rows: PlayStationTitleRow[]): Promise<void> {
  const chunkSize = 500;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const params: unknown[] = [];
    const values = chunk.map((row, index) => {
      const base = index * 8;
      params.push(
        row.platform,
        row.titleId,
        row.conceptId,
        row.name,
        row.contentId,
        row.region,
        row.publisherId,
        row.isGame,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, now())`;
    });

    await sql.query(
      `insert into playstation_titles
        (platform, title_id, concept_id, name, content_id, region, publisher_id, is_game, synced_at)
       values ${values.join(",")}
       on conflict (platform, title_id, region) do update set
         concept_id = excluded.concept_id,
         name = excluded.name,
         content_id = excluded.content_id,
         publisher_id = excluded.publisher_id,
         is_game = excluded.is_game,
         synced_at = now()`,
      params,
    );
  }
}

async function backfillActivityNames(sql: Sql): Promise<number> {
  const rows = await sql.query<{ updated: number | string }>(
    `with preferred as (
       select distinct on (platform, title_id)
              platform, title_id, name
         from playstation_titles
        where is_game = true
        order by platform, title_id,
                 case region
                   when 'IN' then 0
                   when 'AS' then 1
                   when 'EP' then 2
                   when 'UP' then 3
                   when 'JP' then 4
                   when 'HP' then 5
                   else 6
                 end,
                 region
     ), updated as (
       update ps5_activity_events e
          set title_name = p.name
         from preferred p
        where p.platform = case
                  when e.title_id like 'PPSA%' then 'ps5'
                  when e.title_id like 'CUSA%' then 'ps4'
                  else ''
                end
          and p.title_id = e.title_id
          and (e.title_name is null or e.title_name <> p.name)
       returning e.id
     )
     select count(*)::int as updated from updated`,
  );
  return Number(rows[0]?.updated ?? 0);
}

export async function syncPlayStationTitles(sql: Sql) {
  const result: Array<{ platform: string; rows: number; games: number }> = [];
  for (const source of SOURCES) {
    const rows = parseTsv(await fetchSource(source.url), source.platform);
    await upsertRows(sql, rows);
    result.push({
      platform: source.platform,
      rows: rows.length,
      games: rows.filter((row) => row.isGame).length,
    });
  }
  const backfilledActivityRows = await backfillActivityNames(sql);
  return {
    source: "andshrew/PlayStation-Titles",
    platforms: result,
    backfilledActivityRows,
  };
}
