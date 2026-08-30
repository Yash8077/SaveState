import { createFileRoute } from "@tanstack/react-router";
import { nativeAppRedirect } from "@/lib/auth/google-env";
import { auth, readSessionToken } from "@/lib/auth/server";

export const Route = createFileRoute("/api/google/native")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        const token = readSessionToken();
        if (!session?.user || !token) {
          return Response.redirect(new URL("/", request.url), 302);
        }
        const target = nativeAppRedirect(token);
        return new Response(
          `<!doctype html>
<meta charset="utf-8">
<title>SaveState</title>
<meta http-equiv="refresh" content="0;url=${target}">
<body>
<script>location.replace(${JSON.stringify(target)})</script>
<p><a href="${target}">Open SaveState</a></p>
</body>`,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
