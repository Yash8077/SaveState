import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ListEditorValue = {
  status: Status;
  score: number | null;
  favorite: boolean;
};

export function ListEditor({
  title,
  initial,
  saving,
  onSave,
  onClose,
  onRemove,
}: {
  title: string;
  initial?: Partial<ListEditorValue>;
  saving?: boolean;
  onSave: (value: ListEditorValue) => Promise<void> | void;
  onClose: () => void;
  onRemove?: () => Promise<void> | void;
}) {
  const [status, setStatus] = useState<Status>(initial?.status ?? "playing");
  const [score, setScore] = useState<number | null>(initial?.score ?? null);
  const [favorite, setFavorite] = useState(Boolean(initial?.favorite));
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onSave({ status, score, favorite });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-elevated p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">
              {onRemove ? "Edit list" : "Add to library"}
            </p>
            <h2 className="mt-1 truncate text-lg font-medium">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setFavorite((v) => !v)}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle",
              favorite && "text-accent",
            )}
            aria-label={favorite ? "Unfavorite" : "Favorite"}
          >
            <Heart className={cn("size-5", favorite && "fill-current")} />
          </button>
        </div>

        <p className="mt-4 mb-2 text-sm text-muted">Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm font-medium",
                status === s ? "bg-accent text-accent-fg" : "bg-subtle text-muted hover:text-fg",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-sm text-muted">Score</p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(score === n ? null : n)}
              className={cn(
                "grid size-10 place-items-center rounded-full text-sm font-medium tabular-nums",
                score === n ? "bg-accent text-accent-fg" : "bg-subtle text-muted hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onRemove ? (
            <Button variant="ghost" className="sm:mr-auto" disabled={busy || saving} onClick={() => void onRemove()}>
              Remove
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button disabled={busy || saving} onClick={() => void submit()}>
            {busy || saving ? "Saving…" : onRemove ? "Save" : "Add to library"}
          </Button>
        </div>
      </div>
    </div>
  );
}
