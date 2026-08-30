import { cn } from "@/lib/utils";

/** Stacked save-card. Screen fill follows the current accent / dynamic color. */
export function BrandMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("overflow-visible", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="10.5"
        y="2"
        width="16"
        height="22"
        rx="3.2"
        className="fill-accent/35"
      />
      <rect
        x="7.5"
        y="4.8"
        width="16"
        height="22"
        rx="3.2"
        className="fill-accent/55"
      />
      <rect
        x="4.5"
        y="7.6"
        width="16"
        height="22"
        rx="3.2"
        className="fill-elevated stroke-border"
        strokeWidth="0.6"
      />
      <rect x="7.4" y="10.4" width="10.2" height="8" rx="1.6" className="fill-accent" />
      <rect x="7.4" y="20.2" width="10.2" height="2.1" rx="1" className="fill-accent" />
      <rect
        x="7.4"
        y="23.6"
        width="6.4"
        height="2.1"
        rx="1"
        className="fill-accent/55"
      />
    </svg>
  );
}
