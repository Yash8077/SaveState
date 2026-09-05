import { createFileRoute } from "@tanstack/react-router";
import {
  addCustomGameInput,
  addToLibraryInput,
} from "@/lib/library-schema";

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { listLibraryPage } = await import("@/lib/library.server");
          const { canonicalCatalogId } = await import("@/lib/trophy-read.server");
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limitRaw = url.searchParams.get("limit");
          const limit = limitRaw ? Number(limitRaw) : 50;
          if (limitRaw && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
            return apiJson({ error: "Invalid limit" }, 400);
          }
          const page = await listLibraryPage(await getSql(), userId, {
            cursor,
            limit,
          });
          return apiJson({
            ...page,
            items: page.items.map((item) => ({
              ...item,
              catalogId: canonicalCatalogId(item.catalogId),
            })),
          });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
      POST: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const body = (await request.json()) as unknown;
          const { getSql } = await import("@/lib/db");
          const lib = await import("@/lib/library.server");
          const { catalogIdVariants, canonicalCatalogId } = await import(
            "@/lib/trophy-read.server"
          );
          const sql = await getSql();
          const catalog = addToLibraryInput.safeParse(body);
          if (catalog.success) {
            const canonicalId = canonicalCatalogId(catalog.data.catalogId);
            const variants = catalogIdVariants(catalog.data.catalogId);

            // Repair legacy Wiki ids before the normal upsert. If a user has the
            // old encoded/decoded form, promote that existing row to the stable
            // canonical id so the same game cannot split into two library items.
            const existing = await sql.query<{ id: number; catalog_id: string }>(
              `select id, catalog_id
                 from game_entries
                where user_id = $1
                  and catalog_id = any($2::text[])
                order by case when catalog_id = $3 then 0 else 1 end,
                         updated_at desc, id desc
                limit 1`,
              [userId, variants, canonicalId],
            );

            if (existing[0] && existing[0].catalog_id !== canonicalId) {
              const canonicalExists = await sql.query<{ id: number }>(
                `select id from game_entries
                  where user_id = $1 and catalog_id = $2
                  limit 1`,
                [userId, canonicalId],
              );
              if (!canonicalExists[0]) {
                await sql.query(
                  `update game_entries
                      set catalog_id = $3, updated_at = now()
                    where id = $1 and user_id = $2`,
                  [existing[0].id, userId, canonicalId],
                );
              }
            }

            const entry = await lib.addToLibraryRow(sql, userId, {
              ...catalog.data,
              catalogId: canonicalId,
            });
            return apiJson(entry, 201);
          }
          const custom = addCustomGameInput.safeParse(body);
          if (custom.success) {
            const entry = await lib.addCustomGameRow(sql, userId, custom.data);
            return apiJson(entry, 201);
          }
          return apiJson({ error: "Invalid body" }, 400);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
