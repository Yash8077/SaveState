import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import {
  ACCENTS,
  type GrainIntensity,
  type ThemeMode,
} from "@/lib/appearance";
import { useAppearance } from "@/components/appearance-provider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const MODES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Soft paper surfaces" },
  { id: "dark", label: "Dark", hint: "Soft charcoal" },
  { id: "system", label: "System", hint: "Follow the device" },
];

const GRAIN: { id: GrainIntensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function SettingsPage() {
  const { appearance, setAppearance } = useAppearance();

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Appearance only — theme, accent, and surface effects. Player, reader,
          and extension settings are not part of SaveState.
        </p>
      </div>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Sun className="size-4" />
          Theme
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {MODES.map((mode) => {
            const selected = appearance.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setAppearance({ ...appearance, mode: mode.id })}
                className={cn(
                  "rounded-xl border px-2.5 py-3 text-left",
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-subtle",
                )}
              >
                <span
                  className={cn(
                    "block h-16 rounded-lg ring-1 ring-border",
                    mode.id === "light" && "light-preview",
                    mode.id === "dark" && "dark-preview",
                    mode.id === "system" && "system-preview",
                  )}
                />
                <span className="mt-2 block text-sm font-medium">
                  {mode.label}
                </span>
                <span className="text-xs text-faint">{mode.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Moon className="size-4" />
          Appearance
        </p>
        <label className="mt-3 flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">OLED</span>
            <span className="text-xs text-faint">
              True black background in dark mode
            </span>
          </span>
          <input
            type="checkbox"
            checked={appearance.oled}
            onChange={(e) =>
              setAppearance({ ...appearance, oled: e.target.checked })
            }
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Bloom</span>
            <span className="text-xs text-faint">
              Soft accent glow on details banners
            </span>
          </span>
          <input
            type="checkbox"
            checked={appearance.bloom}
            onChange={(e) =>
              setAppearance({ ...appearance, bloom: e.target.checked })
            }
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Grain</span>
            <span className="text-xs text-faint">
              Subtle film grain over the interface
            </span>
          </span>
          <input
            type="checkbox"
            checked={appearance.grain}
            onChange={(e) =>
              setAppearance({ ...appearance, grain: e.target.checked })
            }
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
        {appearance.grain ? (
          <div className="mt-2">
            <p className="mb-2 text-xs text-faint">Grain intensity</p>
            <div className="flex gap-2">
              {GRAIN.map((item) => {
                const selected = appearance.grainIntensity === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setAppearance({
                        ...appearance,
                        grainIntensity: item.id,
                      })
                    }
                    className={cn(
                      "h-10 flex-1 rounded-full text-sm font-medium",
                      selected
                        ? "bg-accent text-accent-fg"
                        : "bg-subtle text-muted",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
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
                onClick={() =>
                  setAppearance({ ...appearance, accent: swatch.id })
                }
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 text-sm",
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-subtle",
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
          <Sparkles className="size-4" />
          Android app
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The app mirrors these theme options, plus Material You from the
          wallpaper on Android 12+.
        </p>
      </section>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Monitor className="size-4" />
          Not included
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Video player, manga reader, extensions, liquid wallpaper, logo
          animation, and refresh-rate controls stay out of SaveState on purpose.
        </p>
      </section>
    </div>
  );
}
