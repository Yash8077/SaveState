import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { getCatalogGame } from "@/lib/api";
import type { Status } from "@/lib/types";
import { cn, formatHours } from "@/lib/utils";

export function GameRail({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">{title}</h2>
        {action}
      </div>
      <div className="rail-scroll">{children}</div>
    </section>
  );
}

export function GameCard({
  catalogId,
  title,
  coverUrl,
  headerUrl,
  status,
  score,
  hours,
  favorite,
  size = "rail",
  priority = false,
}: {
  catalogId: string;
  title: string;
  coverUrl?: string | null;
  headerUrl?: string | null;
  status?: Status;
  score?: number | null;
  hours?: number | null;
  favorite?: boolean;
  size?: "rail" | "grid";
  priority?: boolean;
}) {
  const qc = useQueryClient();

  function prefetch() {
    if (catalogId.startsWith("custom_")) return;
    qc.setQueryData(["catalog-preview", catalogId], {
      title,
      coverUrl: coverUrl ?? null,
      headerUrl: headerUrl ?? null,
    });
    void qc.prefetchQuery({
      queryKey: ["catalog-game", catalogId, "rel-4"],
      queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
      staleTime: 30_000,
    });
  }

  return (
    <Link
      to="/game/$catalogId"
      params={{ catalogId }}
      preload="intent"
      onPointerEnter={prefetch}
      onFocus={prefetch}
      className={cn(
        "group relative block shrink-0 snap-start outline-none",
        "transition-transform duration-150 ease-[var(--ease-smooth-out)]",
        "active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent/60",
        size === "rail"
          ? "w-[7.25rem] sm:w-[8.25rem] expanded:w-[9rem]"
          : "w-full",
      )}
    >
      <Poster
        title={title}
        coverUrl={coverUrl}
        headerUrl={headerUrl}
        priority={priority}
        className="aspect-2/3 w-full rounded-lg"
      />
      {favorite ? (
        <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-bg/75 text-accent">
          <Star className="size-3.5 fill-current" />
        </span>
      ) : null}
      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-fg">
        {title}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {status && size === "rail" ? <StatusBadge status={status} /> : null}
        {score ? (
          <span className="text-xs tabular-nums text-muted">{score}/10</span>
        ) : null}
        {hours != null ? (
          <span className="text-xs tabular-nums text-faint">
            {formatHours(hours)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
