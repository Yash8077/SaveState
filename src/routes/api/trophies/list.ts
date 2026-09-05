import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/trophies/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );

        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { listLibraryTrophyProgressDeduped } = await import(
            "@/lib/trophy-read.server"
          );
          const { summarizeTrophyGames } = await import("@/lib/trophies.server");
          const games = await listLibraryTrophyProgressDeduped(await getSql(), userId);
          const summary = summarizeTrophyGames(games);
          return apiJson({ summary, games });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
