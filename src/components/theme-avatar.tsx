import { AVATAR_SVG } from "@/lib/avatar-svg";
import { avatarIdFromSrc, canonicalizeAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function ThemeAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  const resolved = canonicalizeAvatar(src);
  const id = avatarIdFromSrc(resolved);
  const svg = resolved?.endsWith(".svg") && id ? AVATAR_SVG[id] : null;
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  if (svg) {
    return (
      <span
        className={cn(
          "inline-flex overflow-hidden rounded-full text-[color-mix(in_oklab,var(--color-accent)_54%,#05090b)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.28)] [&>svg]:block [&>svg]:size-full",
          className,
        )}
        role="img"
        aria-label={name ?? id ?? "Avatar"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  if (resolved) {
    return (
      <img
        src={resolved}
        alt=""
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent",
        className,
      )}
    >
      {initial}
    </span>
  );
}
