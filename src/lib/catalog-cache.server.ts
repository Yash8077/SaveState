export const CATALOG_DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
export const CATALOG_RELATED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CatalogCacheKind = "details" | "related";

type QuerySql = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
};

export type CatalogCacheHit<T> = {
  at: number;
  data: T;
  fresh: boolean;
};

export function catalogCacheKey(
  ver: string,
  kind: CatalogCacheKind,
  catalogId: string,
): string {
  return `${kind}:${ver}:${catalogId}`;
}

export function isCatalogCacheFresh(
  fetchedAtMs: number,
  nowMs: number,
  ttlMs: number,
): boolean {
  return nowMs - fetchedAtMs < ttlMs;
}

export function parseCatalogCachePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") return payload as T;
  return null;
}

function skipSharedCache(sql?: QuerySql): boolean {
  return !sql && Boolean(process.env.NODE_TEST_CONTEXT);
}

async function sqlOrDefault(sql?: QuerySql): Promise<QuerySql | null> {
  if (sql) return sql;
  if (skipSharedCache()) return null;
  try {
    const { getSql } = await import("@/lib/db");
    return await getSql();
  } catch {
    return null;
  }
}

export async function readCatalogCache<T>(opts: {
  kind: CatalogCacheKind;
  ver: string;
  catalogId: string;
  ttlMs: number;
  now?: number;
  sql?: QuerySql;
}): Promise<CatalogCacheHit<T> | null> {
  const db = await sqlOrDefault(opts.sql);
  if (!db) return null;
  try {
    const rows = await db.query<{
      payload: unknown;
      fetched_ms: string | number;
    }>(
      `select payload, (extract(epoch from fetched_at) * 1000) as fetched_ms
       from catalog_cache where cache_key = $1`,
      [catalogCacheKey(opts.ver, opts.kind, opts.catalogId)],
    );
    const row = rows[0];
    if (!row) return null;
    const at = Number(row.fetched_ms);
    if (!Number.isFinite(at)) return null;
    const data = parseCatalogCachePayload<T>(row.payload);
    if (data == null) return null;
    const now = opts.now ?? Date.now();
    return {
      at,
      data,
      fresh: isCatalogCacheFresh(at, now, opts.ttlMs),
    };
  } catch {
    return null;
  }
}

export async function writeCatalogCache(opts: {
  kind: CatalogCacheKind;
  ver: string;
  catalogId: string;
  payload: unknown;
  sql?: QuerySql;
}): Promise<void> {
  if (opts.payload == null) return;
  const db = await sqlOrDefault(opts.sql);
  if (!db) return;
  try {
    await db.query(
      `insert into catalog_cache (cache_key, kind, catalog_id, payload, fetched_at)
       values ($1, $2, $3, $4::jsonb, now())
       on conflict (cache_key) do update set
         kind = excluded.kind,
         catalog_id = excluded.catalog_id,
         payload = excluded.payload,
         fetched_at = now()`,
      [
        catalogCacheKey(opts.ver, opts.kind, opts.catalogId),
        opts.kind,
        opts.catalogId,
        JSON.stringify(opts.payload),
      ],
    );
  } catch {
    /* cache is best-effort across cold starts */
  }
}
