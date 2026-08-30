import { useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { STATUSES, STATUS_LABEL, type GameEntry, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TrackerPanel({
  entry,
  saving,
  onSave,
  onRemove,
}: {
  entry: GameEntry;
  saving?: boolean;
  onSave: (patch: {
    status?: Status;
    score?: number | null;
    hours?: number | null;
    favorite?: boolean;
    notes?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}) {
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [hours, setHours] = useState(entry.hours?.toString() ?? "");
  const [startedAt, setStartedAt] = useState(entry.startedAt ?? "");
  const [finishedAt, setFinishedAt] = useState(entry.finishedAt ?? "");

  return (
    <div className="rounded-xl bg-elevated p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-medium">Your log</p>
        <button
          type="button"
          onClick={() => onSave({ favorite: !entry.favorite })}
          className={cn(
            "grid size-11 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-subtle",
            entry.favorite && "text-accent",
          )}
          aria-label={entry.favorite ? "Unfavorite" : "Favorite"}
        >
          <Heart className={cn("size-5", entry.favorite && "fill-current")} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onSave({ status })}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
              entry.status === status
                ? "bg-accent text-accent-fg"
                : "bg-subtle text-muted hover:text-fg",
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm text-muted">Score</p>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSave({ score: entry.score === n ? null : n })}
              className={cn(
                "grid size-10 place-items-center rounded-full text-sm font-medium tabular-nums transition-colors duration-150",
                entry.score === n
                  ? "bg-accent text-accent-fg"
                  : "bg-subtle text-muted hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block text-sm text-muted">
        Hours played
        <Input
          className="mt-1.5"
          inputMode="decimal"
          value={hours}
          placeholder="0"
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => {
            const raw = hours.trim();
            if (!raw) {
              if (entry.hours != null) void onSave({ hours: null });
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) return;
            if (n !== entry.hours) void onSave({ hours: n });
          }}
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm text-muted">
          Started
          <Input
            className="mt-1.5"
            type="date"
            value={startedAt}
            onChange={(e) => {
              setStartedAt(e.target.value);
              void onSave({ startedAt: e.target.value || null });
            }}
          />
        </label>
        <label className="block text-sm text-muted">
          Finished
          <Input
            className="mt-1.5"
            type="date"
            value={finishedAt}
            onChange={(e) => {
              setFinishedAt(e.target.value);
              void onSave({ finishedAt: e.target.value || null });
            }}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-muted">
        Notes
        <Textarea
          className="mt-1.5"
          value={notes}
          placeholder="What stayed with you?"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            const next = notes.trim() || null;
            if (next !== (entry.notes ?? null)) void onSave({ notes: next });
          }}
        />
      </label>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-faint">
          {saving ? "Saving…" : "Synced to your account"}
        </p>
        <Button variant="danger" size="sm" onClick={() => void onRemove()}>
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>
    </div>
  );
}
