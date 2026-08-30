import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Poster } from "@/components/poster";
import type { PeekTarget } from "@/hooks/use-peek";

export function GamePeek({
  game,
  onClose,
}: {
  game: PeekTarget;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const banner = game.headerUrl || game.coverUrl;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-label={game.title}
        className="peek-card w-full max-w-sm overflow-hidden rounded-xl bg-elevated shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-40 bg-subtle">
          {banner ? (
            <img
              src={banner}
              alt=""
              className="size-full object-cover object-center"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-elevated to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-bg/70 text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-end gap-3 px-4 pb-4">
          <Poster
            title={game.title}
            coverUrl={game.coverUrl}
            headerUrl={game.headerUrl}
            className="-mt-10 h-28 w-20 shrink-0 rounded-md shadow-md"
          />
          <div className="min-w-0 pb-0.5">
            <h2 className="text-lg font-medium leading-tight tracking-tight">
              {game.title}
            </h2>
            <Link
              to="/game/$catalogId"
              params={{ catalogId: game.catalogId }}
              onClick={onClose}
              className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              View details
            </Link>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
