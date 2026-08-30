import { createFileRoute } from "@tanstack/react-router";
import { updateEntryInput } from "@/lib/library-schema";

export const Route = createFileRoute("/api/library/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const id = Number(params.id);
          if (!Number.isInteger(id)) return apiJson({ error: "Invalid id" }, 400);
          const body = (await request.json()) as unknown;
          const parsed = updateEntryInput.safeParse({
            ...(typeof body === "object" && body ? body : {}),
            id,
          });
          if (!parsed.success) return apiJson({ error: "Invalid body" }, 400);
          const { getSql } = await import("@/lib/db");
          const { updateEntryRow } = await import("@/lib/library.server");
          const entry = await updateEntryRow(await getSql(), userId, parsed.data);
          return apiJson(entry);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
      DELETE: async ({ request, params }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const id = Number(params.id);
          if (!Number.isInteger(id)) return apiJson({ error: "Invalid id" }, 400);
          const { getSql } = await import("@/lib/db");
          const { removeEntryRow } = await import("@/lib/library.server");
          const result = await removeEntryRow(await getSql(), userId, id);
          return apiJson(result);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
