import { STATUSES, type GameEntry, type Status } from "./types.ts";

export const BACKUP_APP = "SaveState";
export const BACKUP_VERSION = 1;
export const BACKUP_LIMIT = 500;

export type BackupEntry = {
  catalogId: string;
  title: string;
  status: Status;
  score: number | null;
  hours: number | null;
  favorite: boolean;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  coverUrl: string | null;
  headerUrl: string | null;
  summary: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  metacritic: number | null;
  developers: string[];
  publishers: string[];
  screenshots: string[];
};

export type LibraryBackup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  entries: BackupEntry[];
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function asStringOrNull(value: unknown): string | null {
  const text = asString(value);
  return text.length ? text : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return value.split("|").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function asStatus(value: unknown): Status {
  const text = asString(value).toLowerCase();
  return STATUSES.includes(text as Status) ? (text as Status) : "backlog";
}

function asScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function asHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000) return null;
  return n;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = asString(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

export function entryToBackup(entry: GameEntry): BackupEntry {
  return {
    catalogId: entry.catalogId,
    title: entry.title,
    status: entry.status,
    score: entry.score,
    hours: entry.hours,
    favorite: entry.favorite,
    notes: entry.notes,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    coverUrl: entry.coverUrl,
    headerUrl: entry.headerUrl,
    summary: entry.summary,
    releaseDate: entry.releaseDate,
    platforms: entry.platforms,
    genres: entry.genres,
    metacritic: entry.metacritic,
    developers: entry.developers,
    publishers: entry.publishers,
    screenshots: entry.screenshots,
  };
}

export function makeBackup(entries: GameEntry[], now = new Date()): LibraryBackup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    entries: entries.map(entryToBackup),
  };
}

export function backupFilename(ext: "json" | "csv", now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `savestate-library-${dd}-${mm}-${yyyy}.${ext}`;
}

function csvCell(value: unknown): string {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join("|")
        : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function backupToCsv(backup: LibraryBackup): string {
  const header = [
    "catalogId",
    "title",
    "status",
    "score",
    "hours",
    "favorite",
    "notes",
    "startedAt",
    "finishedAt",
  ];
  const lines = [header.join(",")];
  for (const entry of backup.entries) {
    lines.push(
      [
        entry.catalogId,
        entry.title,
        entry.status,
        entry.score,
        entry.hours,
        entry.favorite,
        entry.notes,
        entry.startedAt,
        entry.finishedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = (rows.shift() ?? []).map((item) => item.trim());
  return rows.map((values) => {
    const out: Record<string, string> = {};
    header.forEach((key, i) => {
      out[key] = values[i] ?? "";
    });
    return out;
  });
}

function parseOne(raw: Record<string, unknown>): BackupEntry | null {
  const catalogId = asString(raw.catalogId ?? raw.catalog_id);
  const title = asString(raw.title);
  if (!catalogId && !title) return null;
  return {
    catalogId: catalogId || `custom_${title.toLowerCase().replace(/\s+/g, "_").slice(0, 40)}`,
    title: title || catalogId,
    status: asStatus(raw.status),
    score: asScore(raw.score),
    hours: asHours(raw.hours),
    favorite: asBool(raw.favorite),
    notes: asStringOrNull(raw.notes),
    startedAt: asStringOrNull(raw.startedAt ?? raw.started_at),
    finishedAt: asStringOrNull(raw.finishedAt ?? raw.finished_at),
    coverUrl: asStringOrNull(raw.coverUrl ?? raw.cover_url),
    headerUrl: asStringOrNull(raw.headerUrl ?? raw.header_url),
    summary: asStringOrNull(raw.summary),
    releaseDate: asStringOrNull(raw.releaseDate ?? raw.release_date),
    platforms: asStringArray(raw.platforms),
    genres: asStringArray(raw.genres),
    metacritic:
      typeof raw.metacritic === "number" && Number.isFinite(raw.metacritic)
        ? Math.round(raw.metacritic)
        : asHours(raw.metacritic) !== null
          ? Math.round(Number(raw.metacritic))
          : null,
    developers: asStringArray(raw.developers),
    publishers: asStringArray(raw.publishers),
    screenshots: asStringArray(raw.screenshots),
  };
}

export function parseBackupPayload(raw: unknown): BackupEntry[] {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return parseBackupPayload(JSON.parse(text) as unknown);
      } catch {
        return [];
      }
    }
    return parseCsv(text)
      .map((row) => parseOne(row))
      .filter((row): row is BackupEntry => Boolean(row));
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        item && typeof item === "object"
          ? parseOne(item as Record<string, unknown>)
          : null,
      )
      .filter((row): row is BackupEntry => Boolean(row));
  }
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as { entries?: unknown };
  if (Array.isArray(obj.entries)) return parseBackupPayload(obj.entries);
  return [];
}

export function clampBackupEntries(entries: BackupEntry[]): BackupEntry[] {
  const seen = new Set<string>();
  const out: BackupEntry[] = [];
  for (const entry of entries) {
    if (out.length >= BACKUP_LIMIT) break;
    const key = entry.catalogId || entry.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
