import { canonicalizeAvatar, GUEST_AVATAR } from "@/lib/avatars";
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
  const resolved = canonicalizeAvatar(src) || GUEST_AVATAR;

  return (
    <img
      src={resolved}
      alt={name ?? ""}
      className={cn("rounded-full object-cover", className)}
    />
  );
}
