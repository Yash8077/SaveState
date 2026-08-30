import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Poster({
  title,
  coverUrl,
  headerUrl,
  className,
  priority = false,
}: {
  title: string;
  coverUrl?: string | null;
  headerUrl?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const primary = coverUrl || headerUrl || null;
  const fallback =
    coverUrl && headerUrl && coverUrl !== headerUrl ? headerUrl : null;
  const [src, setSrc] = useState<string | null>(primary);

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  return (
    <div className={cn("relative isolate overflow-hidden bg-subtle", className)}>
      {src ? (
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          decoding="async"
          className="size-full object-cover object-center outline outline-1 -outline-offset-1 outline-white/10"
          onError={() => {
            if (fallback && src !== fallback) setSrc(fallback);
            else setSrc(null);
          }}
        />
      ) : (
        <div className="flex size-full items-end bg-elevated p-2.5">
          <span className="text-sm font-medium leading-tight text-fg/90">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
