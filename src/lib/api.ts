import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  addCustomGameInput,
  addToLibraryInput,
  listLibraryInput,
  updateEntryInput,
} from "@/lib/library-schema";
import type {
  CatalogDetails,
  CatalogGame,
  FeaturedRail,
  LibraryPage,
  LibrarySnapshot,
} from "@/lib/types";

export const CATALOG_GAME_REL = "rel-10";
export const CATALOG_GAME_STALE_MS = 10 * 60_000;

export function catalogGameQueryKey(catalogId: string) {
  return ["catalog-game", catalogId, CATALOG_GAME_REL] as const;
}

async function catalogGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (res.status === 429) throw new Error("Too many requests");
  if (!res.ok) throw new Error("Catalog request failed");
  return (await res.json()) as T;
}

export function searchGames(
  q: string,
  signal?: AbortSignal,
): Promise<CatalogGame[]> {
  return catalogGet<CatalogGame[]>(
    `/api/catalog/search?q=${encodeURIComponent(q)}`,
    signal,
  );
}

export function getCatalogGame(
  id: string,
  signal?: AbortSignal,
): Promise<CatalogDetails | null> {
  return catalogGet<CatalogDetails | null>(
    `/api/catalog/game?id=${encodeURIComponent(id)}&rel=10`,
    signal,
  );
}

export function getFeaturedRails(
  signal?: AbortSignal,
): Promise<FeaturedRail[]> {
  return catalogGet<FeaturedRail[]>(
    `/api/catalog/featured?rel=10`,
    signal,
  );
}

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(listLibraryInput)
  .handler(async ({ context, data }): Promise<LibraryPage> => {
    const { getSql } = await import("@/lib/db");
    const { listLibraryPage } = await import("@/lib/library.server");
    return listLibraryPage(await getSql(), context.userId, {
      cursor: data.cursor ?? null,
      limit: data.limit ?? 50,
    });
  });

export const addToLibrary = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(addToLibraryInput)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { addToLibraryRow } = await import("@/lib/library.server");
    return addToLibraryRow(await getSql(), context.userId, data);
  });

export const addCustomGame = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(addCustomGameInput)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { addCustomGameRow } = await import("@/lib/library.server");
    return addCustomGameRow(await getSql(), context.userId, data);
  });

export const updateEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateEntryInput)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { updateEntryRow } = await import("@/lib/library.server");
    return updateEntryRow(await getSql(), context.userId, data);
  });

export const removeEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { removeEntryRow } = await import("@/lib/library.server");
    return removeEntryRow(await getSql(), context.userId, data.id);
  });

export function snapshotFromDetails(details: {
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  summary?: string | null;
  releaseDate?: string | null;
  platforms: string[];
  genres?: string[];
  metacritic: number | null;
  developers?: string[];
  publishers?: string[];
  screenshots?: string[];
}): LibrarySnapshot {
  return {
    title: details.title,
    coverUrl: details.coverUrl,
    headerUrl: details.headerUrl,
    summary: details.summary ?? null,
    releaseDate: details.releaseDate ?? null,
    platforms: details.platforms,
    genres: details.genres ?? [],
    metacritic: details.metacritic,
    developers: details.developers ?? [],
    publishers: details.publishers ?? [],
    screenshots: details.screenshots ?? [],
  };
}
