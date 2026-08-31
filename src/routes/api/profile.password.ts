import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/profile/password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireApiUser, apiErrorResponse, apiJson } = await import(
          "@/lib/api-auth.server"
        );
        try {
          const userId = await requireApiUser(request);
          const body = (await request.json()) as {
            currentPassword?: unknown;
            newPassword?: unknown;
          };
          const currentPassword =
            typeof body.currentPassword === "string" ? body.currentPassword : "";
          const newPassword =
            typeof body.newPassword === "string" ? body.newPassword : "";
          if (currentPassword.length < 1 || newPassword.length < 8) {
            return apiJson({ error: "Check your passwords" }, 400);
          }
          const { getSql } = await import("@/lib/db");
          const { userHasPassword } = await import("@/lib/profile.server");
          if (!(await userHasPassword(await getSql(), userId))) {
            return apiJson(
              { error: "This account signs in with Google, not a password" },
              400,
            );
          }
          const { auth } = await import("@/lib/auth/server");
          await auth.api.changePassword({
            body: { currentPassword, newPassword },
            headers: request.headers,
          });
          return apiJson({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not change password";
          if (/invalid password|credential/i.test(message)) {
            return apiJson({ error: "Current password is wrong" }, 400);
          }
          return apiErrorResponse(err);
        }
      },
    },
  },
});
