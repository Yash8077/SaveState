import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Palette } from "lucide-react";
import { ACCENTS } from "@/lib/appearance";
import { useAppearance } from "@/components/appearance-provider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { appearance, setAppearance } = useAppearance();

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Appearance only. Library data stays synced to your account.
        </p>
      </div>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Moon className="size-4" />
          Theme
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAppearance({ ...appearance, oled: false })}
            className={cn(
              "rounded-xl border px-3 py-4 text-left",
              !appearance.oled
                ? "border-accent bg-accent/10"
                : "border-border bg-subtle",
            )}
          >
            <span className="block h-10 rounded-lg bg-elevated ring-1 ring-border" />
            <span className="mt-2 block text-sm font-medium">Dark</span>
            <span className="text-xs text-faint">Soft charcoal surfaces</span>
          </button>
          <button
            type="button"
            onClick={() => setAppearance({ ...appearance, oled: true })}
            className={cn(
              "rounded-xl border px-3 py-4 text-left",
              appearance.oled
                ? "border-accent bg-accent/10"
                : "border-border bg-subtle",
            )}
          >
            <span className="oled-preview block h-10 rounded-lg ring-1 ring-border" />
            <span className="mt-2 block text-sm font-medium">OLED</span>
            <span className="text-xs text-faint">True black background</span>
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Palette className="size-4" />
          Accent
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCENTS.map((swatch) => {
            const selected = appearance.accent === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                onClick={() => setAppearance({ ...appearance, accent: swatch.id })}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 text-sm",
                  selected ? "border-accent bg-accent/10" : "border-border bg-subtle",
                )}
              >
                <span
                  className="accent-chip size-4 rounded-full"
                  data-chip={swatch.id}
                />
                {swatch.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Monitor className="size-4" />
          Android app
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The app also has Material You, system light/dark, and the same accent
          chips. Player, reader, and extensions settings from AnymeX are not
          part of SaveState.
        </p>
      </section>
    </div>
  );
}
