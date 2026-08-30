import { STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<Status, string> = {
  playing: "text-playing bg-playing/12",
  beaten: "text-beaten bg-beaten/12",
  backlog: "text-backlog bg-backlog/12",
  hold: "text-hold bg-hold/12",
  dropped: "text-dropped bg-dropped/12",
  wishlist: "text-wishlist bg-wishlist/12",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium",
        TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
