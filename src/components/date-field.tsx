import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { dmyToIso, isoToDmy } from "@/lib/date-format";
import { cn } from "@/lib/utils";

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [text, setText] = useState(isoToDmy(value));
  const native = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  function commitText(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      setText("");
      if (value) onChange("");
      return;
    }
    const iso = dmyToIso(trimmed);
    if (iso) {
      setText(isoToDmy(iso));
      if (iso !== value) onChange(iso);
      return;
    }
    setText(isoToDmy(value));
  }

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          placeholder="dd-mm-yyyy"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-xl bg-subtle px-3 text-sm text-fg",
            "border-0 outline-none ring-1 ring-inset ring-border",
            "focus:ring-accent",
          )}
        />
        <button
          type="button"
          aria-label={`${label} calendar`}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-subtle text-muted ring-1 ring-inset ring-border hover:text-fg"
          onClick={() => native.current?.showPicker?.() ?? native.current?.click()}
        >
          <Calendar className="size-4" />
        </button>
        <input
          ref={native}
          type="date"
          className="sr-only"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {value ? (
        <button
          type="button"
          className="mt-1.5 h-8 text-xs font-medium text-muted hover:text-fg"
          onClick={() => {
            setText("");
            onChange("");
          }}
        >
          Clear date
        </button>
      ) : null}
    </label>
  );
}
