import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GamePeek } from "@/components/game-peek";
import { usePeek } from "@/hooks/use-peek";
import { getCatalogGame } from "@/lib/api";
import type { CatalogGame } from "@/lib/types";
import { cn } from "@/lib/utils";

function loopGames(games: CatalogGame[]) {
  if (games.length < 2) return games;
  return [...games, ...games, ...games];
}

function centerChild(el: HTMLDivElement, child: HTMLElement) {
  const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
  el.scrollTo({ left, behavior: "auto" });
}

function closestIndex(el: HTMLDivElement) {
  const kids = [...el.children] as HTMLElement[];
  if (!kids.length) return 0;
  const mid = el.scrollLeft + el.clientWidth / 2;
  let best = 0;
  let dist = Infinity;
  kids.forEach((child, i) => {
    const c = child.offsetLeft + child.clientWidth / 2;
    const d = Math.abs(c - mid);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

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
  const n = games.length;
  const looped = loopGames(games);
  const origin = n > 1 ? n : 0;
  const jumping = useRef(false);

  const details = useQuery({
    queryKey: ["hero-summary", active?.id],
    queryFn: ({ signal }) => getCatalogGame(active.id, signal),
    enabled: Boolean(active?.id),
    staleTime: 30 * 60_000,
  });
  const summary = details.data?.summary?.trim() || "";

  useEffect(() => {
    const nodes = [phone.current, wide.current].filter(Boolean) as HTMLDivElement[];
    nodes.forEach((el) => {
      const start = el.children[origin] as HTMLElement | undefined;
      if (start) centerChild(el, start);
    });

    const onScroll = (el: HTMLDivElement) => {
      if (jumping.current || n < 2) return;
      const closest = closestIndex(el);
      setIndex(closest % n);
      if (closest < n || closest >= n * 2) {
        const target = origin + (closest % n);
        const child = el.children[target] as HTMLElement | undefined;
        if (!child) return;
        jumping.current = true;
        centerChild(el, child);
        requestAnimationFrame(() => {
          jumping.current = false;
        });
      }
    };
    const cleanups = nodes.map((el) => {
      const handler = () => onScroll(el);
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    });
    return () => cleanups.forEach((fn) => fn());
  }, [games.length, n, origin]);

  useEffect(() => {
    if (!autoplay || n < 2 || paused || peek.target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      go(index + 1);
    }, 6000);
    return () => window.clearInterval(id);
  }, [n, paused, peek.target, index, autoplay]);

  if (!games.length) return null;

  function go(next: number) {
    const real = ((next % n) + n) % n;
    setIndex(real);
    for (const el of [phone.current, wide.current]) {
      if (!el) continue;
      const closest = closestIndex(el);
      let target = origin + real;
      if (n > 1 && closest >= origin) {
        const ahead = origin + n + real;
        const behind = origin - n + real;
        const options = [origin + real, ahead, behind].filter(
          (i) => i >= 0 && i < el.children.length,
        );
        target = options.sort(
          (a, b) => Math.abs(a - closest) - Math.abs(b - closest),
        )[0] ?? target;
      }
      const child = el.children[target] as HTMLElement | undefined;
      if (child) {
        const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
        el.scrollTo({ left, behavior: "smooth" });
      }
    }
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
        <div ref={phone} className="hero-track">
          {looped.map((game, i) => {
            const art = game.headerUrl || game.coverUrl;
            return (
              <Link
                key={`${game.id}-phone-${i}`}
                to="/game/$catalogId"
                params={{ catalogId: game.id }}
                className="hero-slide relative block aspect-video overflow-hidden rounded-2xl"
                {...bindPeek(game)}
              >
                {art ? (
                  <img
                    src={art}
                    alt=""
                    loading={i < origin + 2 ? "eager" : "lazy"}
                    fetchPriority={i === origin ? "high" : "low"}
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
        {looped.map((game, i) => {
          const art = game.coverUrl || game.headerUrl;
          const selected = i % n === index;
          return (
            <Link
              key={`${game.id}-wide-${i}`}
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
                    loading={i < origin + 2 ? "eager" : "lazy"}
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
