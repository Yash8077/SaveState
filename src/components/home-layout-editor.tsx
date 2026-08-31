import { ChevronDown, ChevronUp } from "lucide-react";
import {
  useHomeLayout,
  type LayoutSurface,
} from "@/components/home-layout-provider";
import {
  homeSectionHint,
  homeSectionTitle,
} from "@/lib/home-layout";
import { cn } from "@/lib/utils";

export function HomeLayoutEditor({
  surface,
}: {
  surface: LayoutSurface;
}) {
  const layout = useHomeLayout();
  const sections =
    surface === "home" ? layout.homeSections : layout.discoverSections;

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">
          {surface === "home"
            ? "Show, hide, and reorder Home. Empty lists stay hidden."
            : "Show, hide, and reorder Discover. Empty lists stay hidden."}
        </p>
        <button
          type="button"
          onClick={() => layout.reset(surface)}
          className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-accent"
        >
          Reset
        </button>
      </div>
      {surface === "discover" ? (
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-subtle px-3 py-2">
          <span>
            <span className="block text-sm font-medium">Auto-play carousel</span>
            <span className="block text-xs text-faint">
              Rotate featured games on Discover
            </span>
          </span>
          <input
            type="checkbox"
            checked={layout.autoplay}
            onChange={(event) => layout.setAutoplay(event.target.checked)}
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
      ) : null}
      <ul className="mt-3 space-y-2">
        {sections.map((row, index) => (
          <li
            key={row.id}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2 py-2",
              row.enabled
                ? "border-border bg-subtle"
                : "border-border/60 bg-bg/40 opacity-70",
            )}
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${homeSectionTitle(row.id)} up`}
                disabled={index === 0}
                onClick={() => layout.move(surface, row.id, -1)}
                className="grid size-8 place-items-center rounded-lg text-muted disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${homeSectionTitle(row.id)} down`}
                disabled={index === sections.length - 1}
                onClick={() => layout.move(surface, row.id, 1)}
                className="grid size-8 place-items-center rounded-lg text-muted disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{homeSectionTitle(row.id)}</p>
              <p className="text-xs text-faint">{homeSectionHint(row.id)}</p>
            </div>
            <label className="flex items-center gap-2 pr-2">
              <span className="sr-only">Show {homeSectionTitle(row.id)}</span>
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) =>
                  layout.toggle(surface, row.id, event.target.checked)
                }
                className="size-5 accent-[var(--color-accent)]"
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
