import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GamePeek } from "@/components/game-peek";
import { usePeek } from "@/hooks/use-peek";
import type { CatalogGame } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HeroCarousel({ games }: { games: CatalogGame[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const peek = usePeek<CatalogGame & { catalogId: string }>();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const width = el.clientWidth || 1;
      setIndex(Math.round(el.scrollLeft / width));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [games.length]);

  useEffect(() => {
    if (games.length < 2 || paused || peek.target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const current = Math.round(el.scrollLeft / width);
      const next = (current + 1) % games.length;
      el.scrollTo({ left: next * width, behavior: "smooth" });
    }, 5600);
    return () => window.clearInterval(id);
  }, [games.length, paused, peek.target]);

  if (!games.length) return null;

  function go(next: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <section
      className="relative overflow-hidden rounded-xl bg-elevated"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={scroller} className="hero-track">
        {games.map((game, i) => {
          const art = game.headerUrl || game.coverUrl;
          const peekGame = { ...game, catalogId: game.id };
          return (
            <Link
              key={game.id}
              to="/game/$catalogId"
              params={{ catalogId: game.id }}
              className="hero-slide relative block min-h-48 sm:min-h-56 expanded:min-h-64"
              onPointerDown={(e) => peek.onPointerDown(e, peekGame)}
              onPointerMove={peek.onPointerMove}
              onPointerUp={peek.onPointerUp}
              onPointerCancel={peek.onPointerUp}
              onClickCapture={peek.onClickCapture}
              onContextMenu={(e) => {
                e.preventDefault();
                peek.open(peekGame);
              }}
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
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                  Featured
                </p>
                <h2 className="mt-1 max-w-[18rem] text-xl font-medium tracking-tight sm:text-2xl">
                  {game.title}
                </h2>
              </div>
            </Link>
          );
        })}
      </div>
      {games.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 flex justify-center gap-1.5">
          {games.map((game, i) => (
            <button
              key={game.id}
              type="button"
              aria-label={`Show ${game.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                go(i);
              }}
              className={cn(
                "pointer-events-auto h-1.5 rounded-full transition-[width,background-color] duration-150 ease-[var(--ease-smooth-out)]",
                i === index ? "w-5 bg-accent" : "w-1.5 bg-fg/45",
              )}
            />
          ))}
        </div>
      ) : null}
      {peek.target ? (
        <GamePeek game={peek.target} onClose={peek.close} />
      ) : null}
    </section>
  );
}
