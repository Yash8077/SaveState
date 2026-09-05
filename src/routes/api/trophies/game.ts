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
          const result = await getGameTrophyProgressForCatalog(
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
