import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const { getSql } = await import("@/lib/db");
          const { getProfile } = await import("@/lib/profile.server");
          const profile = await getProfile(await getSql(), userId);
          if (!profile) return apiJson({ error: "Not found" }, 404);
          return apiJson(profile);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
      PATCH: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const body = (await request.json()) as unknown;
          const { profilePatchFromBody, updateProfileRow } = await import(
            "@/lib/profile.server"
          );
          const patch = profilePatchFromBody(body);
          if (!patch) return apiJson({ error: "Invalid profile" }, 400);
          const { getSql } = await import("@/lib/db");
          const profile = await updateProfileRow(await getSql(), userId, patch);
          if (!profile) return apiJson({ error: "Not found" }, 404);
          try {
            const { auth } = await import("@/lib/auth/server");
            const sessionPatch: { name?: string; image?: string | null } = {};
            if (patch.name !== undefined) sessionPatch.name = patch.name;
            if (patch.image !== undefined) sessionPatch.image = patch.image;
            if (Object.keys(sessionPatch).length) {
              await auth.api.updateUser({
                body: sessionPatch,
                headers: request.headers,
              });
            }
          } catch {
            /* SQL already saved; session cookie refresh is best-effort */
          }
          return apiJson(profile);
        } catch (err) {
          return apiErrorResponse(err);
        }
      },
    },
  },
});
