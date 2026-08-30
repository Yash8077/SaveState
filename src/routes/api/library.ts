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
          return apiJson(page);
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
          const sql = await getSql();
          const catalog = addToLibraryInput.safeParse(body);
          if (catalog.success) {
            const entry = await lib.addToLibraryRow(sql, userId, catalog.data);
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
