import type { Sql } from "./db.ts";
import { fetchCatalogDetails } from "./catalog.server.ts";

export type LibraryArtwork = {
  coverUrl: string | null;
  headerUrl: string | null;
};

/**
 * Backfill missing library artwork without overwriting an existing snapshot.
 *
 * Catalog metadata is fetched only when the library entry is missing cover
 * and/or header artwork. The resolved values are persisted so subsequent
 * trophy requests stay database-backed.
 */
export async function ensureLibraryArtwork(
  sql: Sql,
  userId: string,
  catalogId: string,
  current: LibraryArtwork,
): Promise<LibraryArtwork> {
  if (current.coverUrl && current.headerUrl) return current;

  let details: Awaited<ReturnType<typeof fetchCatalogDetails>> | null = null;
  try {
    details = await fetchCatalogDetails(catalogId);
  } catch {
    return current;
  }

  const coverUrl = current.coverUrl || details?.coverUrl || null;
  const headerUrl = current.headerUrl || details?.headerUrl || null;

  if (
    coverUrl !== current.coverUrl ||
    headerUrl !== current.headerUrl
  ) {
    await sql`
      update game_entries
      set
        cover_url = coalesce(nullif(cover_url, ''), ${coverUrl}),
        header_url = coalesce(nullif(header_url, ''), ${headerUrl})
      where user_id = ${userId}
        and catalog_id = ${catalogId}
    `;
  }

  return { coverUrl, headerUrl };
}
