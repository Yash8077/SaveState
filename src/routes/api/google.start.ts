import { createFileRoute } from "@tanstack/react-router";
import { googleAuthEnabled } from "@/lib/auth/google-env";
import { auth } from "@/lib/auth/server";

function redirectTo(url: string, from?: Response) {
  const headers = new Headers();
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  if (from) {
    const cookies =
      typeof from.headers.getSetCookie === "function"
        ? from.headers.getSetCookie()
        : [];
    if (cookies.length) {
      for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    } else {
      const single = from.headers.get("set-cookie");
      if (single) headers.append("Set-Cookie", single);
    }
  }
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/api/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!googleAuthEnabled) {
          return new Response("Google sign-in is not configured", { status: 501 });
        }
        const origin = new URL(request.url).origin;
        try {
          const result = await auth.api.signInSocial({
            body: {
              provider: "google",
              callbackURL: `${origin}/api/google/native`,
              disableRedirect: true,
            },
            headers: request.headers,
            asResponse: true,
          });
          if (result instanceof Response) {
            const location = result.headers.get("Location");
            if (location && result.status >= 300 && result.status < 400) {
              return result;
            }
            const type = result.headers.get("content-type") ?? "";
            if (type.includes("json")) {
              const data = (await result.json()) as { url?: string };
              if (data.url) return redirectTo(data.url, result);
            }
            return result;
          }
          const url = (result as { url?: string } | null)?.url;
          if (!url) {
            return new Response("Could not start Google sign-in", { status: 500 });
          }
          return redirectTo(url);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Google sign-in failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
