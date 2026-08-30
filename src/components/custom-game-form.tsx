import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useLibraryMutations } from "@/hooks/use-library";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CustomGameForm({ onDone }: { onDone?: () => void }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("backlog");
  const [notes, setNotes] = useState("");
  const { custom } = useLibraryMutations();
  const navigate = useNavigate();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        void custom
          .mutateAsync({
            title: trimmed,
            status,
            notes: notes.trim() || undefined,
          })
          .then((entry) => {
            onDone?.();
            void navigate({
              to: "/game/$catalogId",
              params: { catalogId: entry.catalogId },
            });
          });
      }}
    >
      <label className="block text-xs font-medium text-faint">
        Title
        <Input
          className="mt-1.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A game that is not in the catalog"
          required
        />
      </label>
      <div>
        <p className="mb-1.5 text-xs font-medium text-faint">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "h-9 rounded-full px-3 text-sm",
                status === s
                  ? "bg-accent text-accent-fg"
                  : "bg-subtle text-muted",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-xs font-medium text-faint">
        Notes
        <Textarea
          className="mt-1.5"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </label>
      <Button type="submit" disabled={custom.isPending || !title.trim()}>
        {custom.isPending ? "Adding…" : "Add to library"}
      </Button>
    </form>
  );
}
