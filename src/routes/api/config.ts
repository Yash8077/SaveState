import { createFileRoute } from "@tanstack/react-router";
import { googleAuthEnabled } from "@/lib/auth/google-env";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        const { listBuiltInAvatars } = await import("@/lib/avatars.server");
        return Response.json({
          google: googleAuthEnabled,
          avatars: listBuiltInAvatars(),
        });
      },
    },
  },
});
