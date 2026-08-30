import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScreenshotLightbox({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: string[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const total = shots.length;
  const src = shots[index];
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrev) onIndex(index - 1);
      if (event.key === "ArrowRight" && hasNext) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [hasNext, hasPrev, index, onClose, onIndex]);

  if (typeof document === "undefined" || !src) return null;

  return createPortal(
    <div
      className="lightbox-backdrop fixed inset-0 z-50 grid place-items-center bg-bg/88 p-4 sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close screenshot"
        className="absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-full bg-elevated text-fg shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <X className="size-5" />
      </button>

      {hasPrev ? (
        <button
          type="button"
          aria-label="Previous screenshot"
          onClick={(event) => {
            event.stopPropagation();
            onIndex(index - 1);
          }}
          className="absolute left-3 z-10 grid size-12 place-items-center rounded-full bg-elevated/90 text-fg shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 sm:left-6"
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : null}

      {hasNext ? (
        <button
          type="button"
          aria-label="Next screenshot"
          onClick={(event) => {
            event.stopPropagation();
            onIndex(index + 1);
          }}
          className="absolute right-3 z-10 grid size-12 place-items-center rounded-full bg-elevated/90 text-fg shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 sm:right-6"
        >
          <ChevronRight className="size-6" />
        </button>
      ) : null}

      <figure
        className="lightbox-frame relative max-h-[86vh] max-w-[min(92vw,1200px)]"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          key={src}
          src={src}
          alt=""
          className="max-h-[86vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        />
        {total > 1 ? (
          <figcaption className="pointer-events-none absolute inset-x-0 -bottom-10 text-center text-sm tabular-nums text-muted">
            {index + 1} / {total}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body,
  );
}

export function ScreenshotThumb({
  src,
  index,
  onOpen,
}: {
  src: string;
  index: number;
  onOpen: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={cn(
        "shrink-0 rounded-xl bg-transparent p-0",
        "transition-transform duration-300 ease-[var(--ease-smooth-out)]",
        "hover:scale-[1.04] active:scale-[0.98]",
      )}
      aria-label={`View screenshot ${index + 1}`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-36 snap-start rounded-xl object-cover shadow-md sm:h-48"
      />
    </button>
  );
}
