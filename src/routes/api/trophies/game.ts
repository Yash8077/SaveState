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
          const url = new URL(request.url);
          const catalogId = url.searchParams.get("catalogId");
          if (!catalogId) return apiJson({ error: "Missing catalogId" }, 400);

          const { getSql } = await import("@/lib/db");
          const { getTrophyProgressForCatalogGame } = await import(
            "@/lib/trophies.server"
          );
          const result = await getTrophyProgressForCatalogGame(
            await getSql(),
            userId,
            catalogId,
          );
          return apiJson(result);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
