import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { listAllLibrary } = await import("@/lib/library.server");
          const { makeBackup } = await import("@/lib/library-backup");
          const entries = await listAllLibrary(await getSql(), userId);
          return apiJson(makeBackup(entries));
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
          const { parseBackupPayload, clampBackupEntries } = await import(
            "@/lib/library-backup"
          );
          const entries = clampBackupEntries(parseBackupPayload(body));
          if (!entries.length) return apiJson({ error: "No games in file" }, 400);
          const { getSql } = await import("@/lib/db");
          const { importLibraryRows } = await import("@/lib/library.server");
          const result = await importLibraryRows(await getSql(), userId, entries);
          return apiJson(result);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
