import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOST = /(^|\.)wikimedia\.org$/i;
const FETCH_MS = 6000;
const UA = "SaveState/1.0 (https://github.com/Yash8077/SaveState)";

export const Route = createFileRoute("/api/catalog/art")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const src = new URL(request.url).searchParams.get("src") ?? "";
        let parsed: URL;
        try {
          parsed = new URL(src);
        } catch {
          return new Response("Bad src", { status: 400 });
        }
        if (parsed.protocol !== "https:" || !ALLOWED_HOST.test(parsed.hostname)) {
          return new Response("Host not allowed", { status: 400 });
        }
        try {
          const res = await fetch(parsed.toString(), {
            headers: { "User-Agent": UA, Accept: "image/*" },
            signal: AbortSignal.timeout(FETCH_MS),
          });
          if (!res.ok) return new Response("Art missing", { status: 404 });
          const type = res.headers.get("content-type") ?? "image/jpeg";
          if (!type.startsWith("image/")) {
            return new Response("Not an image", { status: 404 });
          }
          return new Response(res.body, {
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
            },
          });
        } catch {
          return new Response("Art missing", { status: 404 });
        }
      },
    },
  },
});
