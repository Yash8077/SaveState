import { cn } from "@/lib/utils";

export const trophyTiers = ["platinum", "gold", "silver", "bronze"] as const;
export type TrophyTier = (typeof trophyTiers)[number];

const ASSETS: Record<string, string> = {
  platinum: "/trophies/platinum.png",
  gold: "/trophies/gold.png",
  silver: "/trophies/silver.png",
  bronze: "/trophies/bronze.png",
};

export function trophyTierSrc(type?: string | null) {
  return ASSETS[type ?? ""] ?? ASSETS.bronze;
}

export function TrophyTierIcon({
  type,
  size = 22,
  faded = false,
  className,
}: {
  type?: string | null;
  size?: number;
  faded?: boolean;
  className?: string;
}) {
  return (
    <img
      src={trophyTierSrc(type)}
      alt=""
      width={Math.round(size * 0.82)}
      height={size}
      className={cn("shrink-0 object-contain", faded && "opacity-40", className)}
      style={{ width: Math.round(size * 0.82), height: size }}
    />
  );
}

export function TrophyTierCount({
  type,
  value,
  size = 22,
  className,
}: {
  type: string;
  value: string | number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}>
      <TrophyTierIcon type={type} size={size} />
      <span className="font-semibold">{value}</span>
    </span>
  );
}
