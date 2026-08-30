import { createFileRoute } from "@tanstack/react-router";
import { googleAuthEnabled } from "@/lib/auth/google-env";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!googleAuthEnabled) {
          return new Response("Google sign-in is not configured", { status: 501 });
        }
        const origin = new URL(request.url).origin;
        try {
          return await auth.api.signInSocial({
            body: {
              provider: "google",
              callbackURL: `${origin}/api/google/native`,
            },
            headers: request.headers,
            asResponse: true,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Google sign-in failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
