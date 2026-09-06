import { cn } from "@/lib/utils";

export const trophyTiers = ["platinum", "gold", "silver", "bronze"] as const;
export type TrophyTier = (typeof trophyTiers)[number];

const ASSETS: Record<string, string> = {
  platinum: "/trophies/platinum.png",
  gold: "/trophies/gold.png",
  silver: "/trophies/silver.png",
  bronze: "/trophies/bronze.png",
};

/** Sony-style optical size: platinum biggest, bronze smallest. Silver is the requested size. */
export function trophyGradeScale(type?: string | null) {
  switch (type) {
    case "platinum":
      return 1.24;
    case "gold":
      return 1.12;
    case "silver":
      return 1;
    default:
      return 0.86;
  }
}

export function trophyTierSrc(type?: string | null) {
  return ASSETS[type ?? ""] ?? ASSETS.bronze;
}

export function TrophyTierIcon({
  type,
  size = 22,
  faded = false,
  graded = true,
  className,
}: {
  type?: string | null;
  size?: number;
  faded?: boolean;
  graded?: boolean;
  className?: string;
}) {
  const scale = graded ? trophyGradeScale(type) : 1;
  const slot = size * (graded ? trophyGradeScale("platinum") : 1);
  const drawn = size * scale;

  return (
    <span
      className={cn("grid shrink-0 place-items-center", faded && "opacity-40", className)}
      style={{ width: slot, height: slot }}
    >
      <img
        src={trophyTierSrc(type)}
        alt=""
        width={drawn}
        height={drawn}
        className="object-contain"
        style={{ width: drawn, height: drawn }}
      />
    </span>
  );
}

export function TrophyTierCount({
  type,
  value,
  size = 22,
  stacked = false,
  graded = true,
  className,
}: {
  type: string;
  value: string | number;
  size?: number;
  stacked?: boolean;
  graded?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex tabular-nums",
        stacked ? "flex-col items-center gap-1" : "items-center gap-1.5",
        className,
      )}
    >
      <TrophyTierIcon type={type} size={size} graded={graded} />
      <span className="font-semibold">{value}</span>
    </span>
  );
}
