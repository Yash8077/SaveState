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
          const { listLibraryTrophyProgressFast } = await import(
            "@/lib/trophy-list.server"
          );
          const { summarizeTrophyGames } = await import("@/lib/trophies.server");

          // The overview uses one DB-only aggregate path. It is still scoped
          // to this user's library, so trophy rows for non-library games are
          // never returned by this endpoint.
          const games = await listLibraryTrophyProgressFast(await getSql(), userId);
          const summary = summarizeTrophyGames(games);
          return apiJson({ summary, games });
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
