import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/discover",
      search: { q: search.q || undefined },
    });
  },
  component: () => null,
});
