import { createFileRoute } from "@tanstack/react-router";
import { googleAuthEnabled } from "@/lib/auth/google-env";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          google: googleAuthEnabled,
        }),
    },
  },
});
