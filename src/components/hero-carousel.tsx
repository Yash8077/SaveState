import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GamePeek } from "@/components/game-peek";
import { usePeek } from "@/hooks/use-peek";
import { getCatalogGame } from "@/lib/api";
import type { CatalogGame } from "@/lib/types";
import { cn } from "@/lib/utils";

function scoreLabel(score: number | null) {
  if (score == null) return null;
  return (score / 10).toFixed(1);
}

function TitleRow({
  game,
  className,
}: {
  game: CatalogGame;
  className?: string;
}) {
  const score = scoreLabel(game.metacritic);
  return (
    <div className={cn("mt-3 flex items-start justify-between gap-3", className)}>
      <h2 className="min-w-0 text-lg font-medium tracking-tight sm:text-xl">
        {game.title}
      </h2>
      {score ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
          ★ {score}
        </span>
      ) : null}
    </div>
  );
}

function Synopsis({
  text,
  compact,
}: {
  text?: string | null;
  compact?: boolean;
}) {
  if (!text) return null;
  return (
    <p
      className={cn(
        "mt-2 rounded-xl bg-elevated px-3 py-2 text-sm leading-snug text-muted",
        compact ? "line-clamp-2" : "line-clamp-3",
      )}
    >
      {text}
    </p>
  );
}

export function HeroCarousel({
  games,
  autoplay = true,
}: {
  games: CatalogGame[];
  autoplay?: boolean;
}) {
  const phone = useRef<HTMLDivElement>(null);
  const wide = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const peek = usePeek<CatalogGame & { catalogId: string }>();
  const active = games[index] ?? games[0];
  const details = useQuery({
    queryKey: ["hero-summary", active?.id],
    queryFn: ({ signal }) => getCatalogGame(active.id, signal),
    enabled: Boolean(active?.id),
    staleTime: 30 * 60_000,
  });
  const summary = details.data?.summary?.trim() || "";

  useEffect(() => {
    const nodes = [phone.current, wide.current].filter(Boolean) as HTMLDivElement[];
    const onScroll = (el: HTMLDivElement) => {
      const card = el.firstElementChild as HTMLElement | null;
      const width = card?.getBoundingClientRect().width || el.clientWidth || 1;
      const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || "0") || 0;
      setIndex(Math.round(el.scrollLeft / (width + gap)));
    };
    const cleanups = nodes.map((el) => {
      const handler = () => onScroll(el);
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    });
    return () => cleanups.forEach((fn) => fn());
  }, [games.length]);

  useEffect(() => {
    if (!autoplay || games.length < 2 || paused || peek.target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      const next = (index + 1) % games.length;
      go(next);
    }, 6000);
    return () => window.clearInterval(id);
  }, [games.length, paused, peek.target, index, autoplay]);

  if (!games.length) return null;

  function go(next: number) {
    const target = Math.max(0, Math.min(next, games.length - 1));
    for (const el of [phone.current, wide.current]) {
      if (!el) continue;
      const card = el.firstElementChild as HTMLElement | null;
      const width = card?.getBoundingClientRect().width || el.clientWidth || 1;
      const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || "0") || 0;
      el.scrollTo({ left: target * (width + gap), behavior: "smooth" });
    }
    setIndex(target);
  }

  function bindPeek(game: CatalogGame) {
    const peekGame = { ...game, catalogId: game.id };
    return {
      onPointerDown: (e: PointerEvent) => peek.onPointerDown(e, peekGame),
      onPointerMove: peek.onPointerMove,
      onPointerUp: peek.onPointerUp,
      onPointerCancel: peek.onPointerUp,
      onClickCapture: peek.onClickCapture,
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
        peek.open(peekGame);
      },
    };
  }

  return (
    <section
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-phone">
        <div ref={phone} className="hero-track rounded-2xl bg-elevated">
          {games.map((game, i) => {
            const art = game.headerUrl || game.coverUrl;
            return (
              <Link
                key={game.id}
                to="/game/$catalogId"
                params={{ catalogId: game.id }}
                className="hero-slide relative block aspect-video overflow-hidden"
                {...bindPeek(game)}
              >
                {art ? (
                  <img
                    src={art}
                    alt=""
                    loading={i < 2 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    className="absolute inset-0 size-full object-cover object-center"
                  />
                ) : (
                  <div className="absolute inset-0 bg-subtle" />
                )}
              </Link>
            );
          })}
        </div>
        {active ? (
          <Link
            to="/game/$catalogId"
            params={{ catalogId: active.id }}
            className="block px-0.5"
          >
            <TitleRow game={active} />
            <Synopsis text={summary} />
          </Link>
        ) : null}
        {games.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5">
            {games.map((game, i) => (
              <button
                key={game.id}
                type="button"
                aria-label={`Show ${game.title}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-150 ease-[var(--ease-smooth-out)]",
                  i === index ? "w-5 bg-accent" : "w-1.5 bg-fg/35",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div
        ref={wide}
        className="hero-wide-track"
      >
        {games.map((game, i) => {
          const art = game.coverUrl || game.headerUrl;
          const selected = i === index;
          return (
            <Link
              key={game.id}
              to="/game/$catalogId"
              params={{ catalogId: game.id }}
              className={cn(
                "hero-wide-slide transition-transform duration-300 ease-[var(--ease-smooth-out)]",
                selected ? "scale-100" : "scale-[0.94]",
              )}
              {...bindPeek(game)}
            >
              <div className="hero-poster bg-elevated">
                {art ? (
                  <img
                    src={art}
                    alt=""
                    loading={i < 2 ? "eager" : "lazy"}
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <TitleRow game={game} />
              {selected ? <Synopsis text={summary} compact /> : null}
            </Link>
          );
        })}
      </div>
      {peek.target ? (
        <GamePeek game={peek.target} onClose={peek.close} />
      ) : null}
    </section>
  );
}
