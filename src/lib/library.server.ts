import type { Sql } from "./db.ts";
import type {
  AddCustomGameInput,
  AddToLibraryInput,
  UpdateEntryInput,
} from "./library-schema.ts";
import {
  STATUSES,
  type GameEntry,
  type LibraryPage,
  type Status,
} from "./types.ts";

export type { AddCustomGameInput, AddToLibraryInput, UpdateEntryInput };

type EntryRow = {
  id: number;
  catalog_id: string;
  title: string;
  cover_url: string | null;
  header_url: string | null;
  summary: string | null;
  release_date: string | null;
  platforms: unknown;
  genres: unknown;
  metacritic: number | null;
  developers: unknown;
  publishers: unknown;
  screenshots: unknown;
  status: string;
  score: number | null;
  hours: number | string | null;
  favorite: boolean;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const ENTRY_SELECT = `
  id, catalog_id, title, cover_url, header_url, summary, release_date,
  platforms, genres, metacritic, developers, publishers, screenshots,
  status, score, hours, favorite, notes, started_at, finished_at,
  created_at::text as created_at, updated_at::text as updated_at
`;

function toHours(value: number | string | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function mapEntry(row: EntryRow): GameEntry {
  const status = STATUSES.includes(row.status as Status)
    ? (row.status as Status)
    : "backlog";
  return {
    id: row.id,
    catalogId: row.catalog_id,
    title: row.title,
    coverUrl: row.cover_url,
    headerUrl: row.header_url,
    summary: row.summary,
    releaseDate: row.release_date,
    platforms: asStringArray(row.platforms),
    genres: asStringArray(row.genres),
    metacritic: row.metacritic,
    developers: asStringArray(row.developers),
    publishers: asStringArray(row.publishers),
    screenshots: asStringArray(row.screenshots),
    status,
    score: row.score,
    hours: toHours(row.hours),
    favorite: row.favorite,
    notes: row.notes,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
