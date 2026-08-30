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
        const result = await auth.api.signInSocial({
          body: {
            provider: "google",
            callbackURL: `${origin}/api/google/native`,
          },
          headers: request.headers,
        });
        const url = (result as { url?: string } | null)?.url;
        if (!url) {
          return new Response("Could not start Google sign-in", { status: 500 });
        }
        return Response.redirect(url, 302);
      },
    },
  },
});
