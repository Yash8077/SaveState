import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseIso(raw: string | null | undefined): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? "");
  if (!match) return { year: 0, month: 0, day: 0 };
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function toIso(year: number, month: number, day: number): string {
  if (!year || !month || !day) return "";
  const max = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, max))}`;
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = parseIso(value);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);

  useEffect(() => {
    const next = parseIso(value);
    setYear(next.year);
    setMonth(next.month);
    setDay(next.day);
  }, [value]);

  const now = new Date().getFullYear();
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = now + 1; y >= 1970; y--) out.push(y);
    return out;
  }, [now]);
  const maxDay = year && month ? new Date(year, month, 0).getDate() : 31;

  function commit(nextYear: number, nextMonth: number, nextDay: number) {
    if (!nextYear && !nextMonth && !nextDay) {
      setYear(0);
      setMonth(0);
      setDay(0);
      onChange("");
      return;
    }
    const y = nextYear || new Date().getFullYear();
    const m = nextMonth || 1;
    const max = new Date(y, m, 0).getDate();
    const d = Math.min(nextDay || 1, max);
    setYear(y);
    setMonth(m);
    setDay(d);
    onChange(toIso(y, m, d));
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm text-muted">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,0.9fr)] gap-1.5">
        <select
          aria-label={`${label} year`}
          value={year || ""}
          onChange={(e) =>
            commit(Number(e.target.value) || 0, month, day)
          }
          className={cn(
            "h-12 min-w-0 rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-2 pr-7 text-sm text-fg",
            "focus:border-accent focus:outline-none",
          )}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} month`}
          value={month || ""}
          onChange={(e) =>
            commit(year, Number(e.target.value) || 0, day)
          }
          className={cn(
            "h-12 min-w-0 rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-2 pr-7 text-sm text-fg",
            "focus:border-accent focus:outline-none",
          )}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} day`}
          value={day && day <= maxDay ? day : ""}
          onChange={(e) =>
            commit(year, month, Number(e.target.value) || 0)
          }
          className={cn(
            "h-12 min-w-0 rounded-md rounded-b-sm border-0 border-b border-border-strong bg-subtle px-2 pr-7 text-sm text-fg",
            "focus:border-accent focus:outline-none",
          )}
        >
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {year || month || day ? (
        <button
          type="button"
          className="mt-1.5 h-8 text-xs font-medium text-muted hover:text-fg"
          onClick={() => commit(0, 0, 0)}
        >
          Clear date
        </button>
      ) : null}
    </fieldset>
  );
}
