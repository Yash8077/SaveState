import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/trophies/game")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );

        try {
          const userId = await requireApiUser(request);
          const catalogId = new URL(request.url).searchParams.get("catalogId")?.trim() ?? "";
          if (!catalogId || catalogId.length > 300) {
            return apiJson({ error: "Invalid catalogId" }, 400);
          }

          const { getSql } = await import("@/lib/db");
          const { getGameTrophyProgressForCatalog } = await import(
            "@/lib/trophy-read.server"
          );
          const { ensureLibraryArtwork } = await import(
            "@/lib/library-artwork.server"
          );

          const sql = await getSql();
          const result = await getGameTrophyProgressForCatalog(
            sql,
            userId,
            catalogId,
          );

          if (!result.found) return apiJson(result);

          // Older library rows may have trophy data but no artwork snapshot.
          // Fill it once from the catalog and persist it for future requests.
          const artwork = await ensureLibraryArtwork(sql, userId, catalogId, {
            coverUrl: result.coverUrl,
            headerUrl: result.headerUrl,
          });

          return apiJson({
            ...result,
            ...artwork,
          });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
