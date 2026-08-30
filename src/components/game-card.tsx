import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { GamePeek } from "@/components/game-peek";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { usePeek } from "@/hooks/use-peek";
import {
  catalogGameQueryKey,
  CATALOG_GAME_STALE_MS,
  getCatalogGame,
} from "@/lib/api";
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
  capsuleUrl,
  status,
  score,
  hours,
  favorite,
  badge,
  size = "rail",
  priority = false,
}: {
  catalogId: string;
  title: string;
  coverUrl?: string | null;
  headerUrl?: string | null;
  capsuleUrl?: string | null;
  status?: Status;
  score?: number | null;
  hours?: number | null;
  favorite?: boolean;
  badge?: string;
  size?: "rail" | "grid";
  priority?: boolean;
}) {
  const qc = useQueryClient();
  const peek = usePeek();

  function prefetch() {
    if (catalogId.startsWith("custom_")) return;
    qc.setQueryData(["catalog-preview", catalogId], {
      title,
      coverUrl: coverUrl ?? null,
      headerUrl: headerUrl ?? null,
      capsuleUrl: capsuleUrl ?? null,
    });
    void qc.prefetchQuery({
      queryKey: catalogGameQueryKey(catalogId),
      queryFn: ({ signal }) => getCatalogGame(catalogId, signal),
      staleTime: CATALOG_GAME_STALE_MS,
    });
  }

  const peekGame = { catalogId, title, coverUrl, headerUrl, capsuleUrl };

  return (
    <>
      <Link
        to="/game/$catalogId"
        params={{ catalogId }}
        preload="intent"
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onPointerDown={(e) => peek.onPointerDown(e, peekGame)}
        onPointerMove={peek.onPointerMove}
        onPointerUp={peek.onPointerUp}
        onPointerCancel={peek.onPointerUp}
        onClickCapture={peek.onClickCapture}
        onContextMenu={(e) => {
          e.preventDefault();
          peek.open(peekGame);
        }}
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
          capsuleUrl={capsuleUrl}
          priority={priority}
          className="aspect-2/3 w-full rounded-lg"
        />
        {badge ? (
          <span className="absolute top-1.5 left-1.5 rounded-sm bg-bg/80 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {badge}
          </span>
        ) : null}
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
      {peek.target ? (
        <GamePeek game={peek.target} onClose={peek.close} />
      ) : null}
    </>
  );
}
