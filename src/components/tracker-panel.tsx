import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DateField } from "@/components/date-field";
import type { GameEntry } from "@/lib/types";

function dateValue(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.slice(0, 10);
}

export function TrackerPanel({
  entry,
  saving,
  onSave,
  onRemove,
}: {
  entry: GameEntry;
  saving?: boolean;
  onSave: (patch: {
    hours?: number | null;
    notes?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}) {
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [hours, setHours] = useState(entry.hours?.toString() ?? "");
  const [startedAt, setStartedAt] = useState(dateValue(entry.startedAt));
  const [finishedAt, setFinishedAt] = useState(dateValue(entry.finishedAt));

  return (
    <div className="rounded-xl bg-elevated p-4 sm:p-5">
      <p className="text-base font-medium">Your log</p>

      <label className="mt-4 block text-sm text-muted">
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

      <div className="mt-4 space-y-4">
        <DateField
          label="Start date"
          value={startedAt}
          onChange={(next) => {
            setStartedAt(next);
            void onSave({ startedAt: next || null });
          }}
        />
        <DateField
          label="End date"
          value={finishedAt}
          onChange={(next) => {
            setFinishedAt(next);
            void onSave({ finishedAt: next || null });
          }}
        />
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
