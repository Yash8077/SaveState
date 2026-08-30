import { useEffect, useState } from "react";
import { cn, normalizeArtUrl } from "@/lib/utils";

export function Poster({
  title,
  coverUrl,
  headerUrl,
  capsuleUrl,
  className,
  priority = false,
}: {
  title: string;
  coverUrl?: string | null;
  headerUrl?: string | null;
  capsuleUrl?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const cover = normalizeArtUrl(coverUrl);
  const header = normalizeArtUrl(headerUrl);
  const capsule = normalizeArtUrl(capsuleUrl);
  const chain = [cover, header, capsule].filter(
    (url, index, list): url is string => Boolean(url) && list.indexOf(url) === index,
  );
  const [src, setSrc] = useState<string | null>(chain[0] ?? null);

  useEffect(() => {
    setSrc(chain[0] ?? null);
  }, [chain[0], chain[1], chain[2]]);

  return (
    <div className={cn("relative isolate overflow-hidden bg-subtle", className)}>
      {src ? (
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-cover object-center outline outline-1 -outline-offset-1 outline-white/10"
          onError={() => {
            const idx = src ? chain.indexOf(src) : -1;
            setSrc(chain[idx + 1] ?? null);
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
