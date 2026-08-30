import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import {
  ACCENTS,
  type GrainIntensity,
  type ThemeMode,
} from "@/lib/appearance";
import { HomeLayoutEditor } from "@/components/home-layout-editor";
import { useAppearance } from "@/components/appearance-provider";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { tintForCatalog } from "@/lib/tints";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const MODES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Soft paper" },
  { id: "dark", label: "Dark", hint: "Charcoal" },
  { id: "system", label: "System", hint: "Follow device" },
];

const GRAIN: { id: GrainIntensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function SettingsPage() {
  const { appearance, setAppearance, setDynamicAccent } = useAppearance();

  function setMode(mode: ThemeMode) {
    setAppearance({ ...appearance, mode });
  }

  function setDynamic(next: boolean) {
    setAppearance({ ...appearance, dynamic: next });
    if (next) {
      const seed = FEATURED_SEED[0]?.games[0]?.id;
      if (seed) setDynamicAccent(tintForCatalog(seed));
    } else {
      setDynamicAccent(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Theme, accent, home layout, and surface effects.
        </p>
      </div>

      <HomeLayoutEditor />
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
                onClick={() => setMode(mode.id)}
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
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={appearance.mode === "light"}
            onClick={() =>
              setAppearance({ ...appearance, oled: !appearance.oled })
            }
            className={cn(
              "rounded-xl border px-2.5 py-3 text-left",
              appearance.oled && appearance.mode !== "light"
                ? "border-accent bg-accent/10"
                : "border-border bg-subtle",
              appearance.mode === "light" && "opacity-50",
            )}
          >
            <span className="oled-preview block h-16 rounded-lg ring-1 ring-border" />
            <span className="mt-2 block text-sm font-medium">OLED</span>
            <span className="text-xs text-faint">True black</span>
          </button>
          <button
            type="button"
            onClick={() => setDynamic(!appearance.dynamic)}
            className={cn(
              "rounded-xl border px-2.5 py-3 text-left",
              appearance.dynamic
                ? "border-accent bg-accent/10"
                : "border-border bg-subtle",
            )}
          >
            <span className="dynamic-preview block h-16 rounded-lg ring-1 ring-border" />
            <span className="mt-2 block text-sm font-medium">Dynamic</span>
            <span className="text-xs text-faint">From home banner</span>
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <Moon className="size-4" />
          Appearance
        </p>
        <label className="mt-3 flex min-h-12 items-center justify-between gap-3">
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
        <p className="mt-1 text-xs text-faint">
          {appearance.dynamic
            ? "Preset chips are a fallback while Dynamic is on."
            : "Used when Dynamic is off."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCENTS.map((swatch) => {
            const selected =
              !appearance.dynamic && appearance.accent === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                onClick={() =>
                  setAppearance({
                    ...appearance,
                    accent: swatch.id,
                    dynamic: false,
                  })
                }
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-3 text-sm",
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-subtle",
                  appearance.dynamic && "opacity-60",
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
          Material You
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          On the website, Dynamic pulls a restrained accent from the home
          banner. The Android app can also take color from the wallpaper on
          Android 12+.
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
