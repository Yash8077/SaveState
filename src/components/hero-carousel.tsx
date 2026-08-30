import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GamePeek } from "@/components/game-peek";
import { usePeek } from "@/hooks/use-peek";
import type { CatalogGame } from "@/lib/types";
import { cn } from "@/lib/utils";

function loopGames(games: CatalogGame[]) {
  if (games.length < 2) return games;
  return [...games, ...games, ...games];
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

function targetLeft(el: HTMLDivElement, child: HTMLElement) {
  return child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
}

function scoreLabel(score: number | null) {
  if (score == null) return null;
  return (score / 10).toFixed(1);
}

function ScoreBadge({ score }: { score: number | null }) {
  const label = scoreLabel(score);
  if (!label) return null;
  return (
    <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
      ★ {label}
    </span>
  );
}

function TitleRow({ game }: { game: CatalogGame }) {
  const score = scoreLabel(game.metacritic);
  return (
    <div className="mt-2 flex h-7 items-center justify-between gap-2">
      <h2 className="min-w-0 truncate text-sm font-medium tracking-tight sm:text-base">
        {game.title}
      </h2>
      {score ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
          ★ {score}
        </span>
      ) : null}
    </div>
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
  const jumping = useRef(false);
  const settle = useRef(0);
  const n = games.length;
  const looped = loopGames(games);
  const origin = n > 1 ? n : 0;
  const active = games[index] ?? games[0];

  function tracks() {
    return [phone.current, wide.current].filter(
      (el): el is HTMLDivElement => Boolean(el && el.clientWidth > 8),
    );
  }

  function snapTo(el: HTMLDivElement, i: number, smooth: boolean) {
    const child = el.children[i] as HTMLElement | undefined;
    if (!child) return;
    const left = targetLeft(el, child);
    if (smooth) {
      el.scrollTo({ left, behavior: "smooth" });
      return;
    }
    jumping.current = true;
    el.classList.add("hero-jumping");
    el.scrollLeft = left;
    requestAnimationFrame(() => {
      el.scrollLeft = left;
      requestAnimationFrame(() => {
        el.classList.remove("hero-jumping");
        jumping.current = false;
      });
    });
  }

  function wrapCopies(el: HTMLDivElement) {
    if (jumping.current || n < 2) return;
    const closest = closestIndex(el);
    if (closest < n) snapTo(el, closest + n, false);
    else if (closest >= n * 2) snapTo(el, closest - n, false);
    setIndex(((closest % n) + n) % n);
  }

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const bind = () => {
      if (cancelled) return;
      const nodes = tracks();
      if (!nodes.length) {
        requestAnimationFrame(bind);
        return;
      }
      nodes.forEach((el) => snapTo(el, origin, false));
      nodes.forEach((el) => {
        const scroll = () => {
          if (jumping.current || n < 2) return;
          setIndex(closestIndex(el) % n);
          window.clearTimeout(settle.current);
          settle.current = window.setTimeout(() => wrapCopies(el), 140);
        };
        const end = () => {
          window.clearTimeout(settle.current);
          wrapCopies(el);
        };
        el.addEventListener("scroll", scroll, { passive: true });
        el.addEventListener("scrollend", end);
        cleanups.push(() => {
          el.removeEventListener("scroll", scroll);
          el.removeEventListener("scrollend", end);
        });
      });
    };

    bind();
    return () => {
      cancelled = true;
      window.clearTimeout(settle.current);
      cleanups.forEach((fn) => fn());
    };
  }, [n, origin]);

  useEffect(() => {
    if (!autoplay || n < 2 || paused || peek.target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      for (const el of tracks()) {
        const next = closestIndex(el) + 1;
        if (next < el.children.length) snapTo(el, next, true);
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, [n, paused, peek.target, autoplay]);

  if (!games.length) return null;

  function go(real: number) {
    const target = ((real % n) + n) % n;
    setIndex(target);
    for (const el of tracks()) {
      const closest = closestIndex(el);
      const copies = [target, target + n, target + 2 * n].filter(
        (i) => i >= 0 && i < el.children.length,
      );
      const nearest = copies.sort(
        (a, b) => Math.abs(a - closest) - Math.abs(b - closest),
      )[0];
      if (nearest != null) snapTo(el, nearest, true);
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
                    loading={i >= origin && i < origin + 2 ? "eager" : "lazy"}
                    fetchPriority={i === origin ? "high" : "low"}
                    className="absolute inset-0 size-full object-cover object-center"
                  />
                ) : (
                  <div className="absolute inset-0 bg-subtle" />
                )}
                <ScoreBadge score={game.metacritic} />
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
          </Link>
        ) : null}
        {n > 1 ? (
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

      <div ref={wide} className="hero-wide-track">
        {looped.map((game, i) => {
          const art = game.coverUrl || game.headerUrl;
          const selected = n > 0 && i % n === index;
          return (
            <Link
              key={`${game.id}-wide-${i}`}
              to="/game/$catalogId"
              params={{ catalogId: game.id }}
              className={cn("hero-wide-slide", selected && "is-active")}
              {...bindPeek(game)}
            >
              <div className="hero-poster relative bg-elevated">
                {art ? (
                  <img
                    src={art}
                    alt=""
                    loading={i >= origin && i < origin + 2 ? "eager" : "lazy"}
                    className="size-full object-cover"
                  />
                ) : null}
                <ScoreBadge score={game.metacritic} />
              </div>
              <TitleRow game={game} />
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
