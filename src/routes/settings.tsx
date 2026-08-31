import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import {
  ACCENTS,
  type GrainIntensity,
  type ThemeMode,
} from "@/lib/appearance";
import { HomeLayoutEditor } from "@/components/home-layout-editor";
import { BrandMark } from "@/components/brand-mark";
import { useAppearance } from "@/components/appearance-provider";
import { FEATURED_SEED } from "@/lib/catalog-seed";
import { tintForCatalog } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useQueryClient } from "@tanstack/react-query";
import { libraryKey } from "@/hooks/use-library";
import {
  backupFilename,
  backupToCsv,
  type LibraryBackup,
} from "@/lib/library-backup";
import { Button } from "@/components/ui/button";

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

type Page =
  | "home"
  | "theme"
  | "appearance"
  | "accent"
  | "material"
  | "order"
  | "backup"
  | "about";

const PAGES: { id: Exclude<Page, "home">; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "theme", label: "Theme", hint: "Light, dark, OLED, dynamic", icon: Sun },
  { id: "appearance", label: "Appearance", hint: "Bloom and film grain", icon: Moon },
  { id: "accent", label: "Accent", hint: "Teal, blue, violet, amber, rose", icon: Palette },
  { id: "material", label: "Material You", hint: "Wallpaper tints", icon: Sparkles },
  { id: "order", label: "Order", hint: "Homepage sections", icon: LayoutGrid },
  { id: "backup", label: "Backup", hint: "Export and import your library", icon: Archive },
  { id: "about", label: "Not included", hint: "What SaveState is not", icon: Monitor },
];

function SettingsPage() {
  const [page, setPage] = useState<Page>("home");
  const current = PAGES.find((item) => item.id === page);

  return (
    <div className="mx-auto max-w-xl pb-8">
      {page === "home" ? (
        <>
          <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted">Theme, order, backup, and the rest.</p>
          <nav className="mt-5 overflow-hidden rounded-2xl bg-elevated">
            {PAGES.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-subtle",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-subtle text-accent">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-faint">{item.hint}</span>
                  </span>
                  <ChevronRight className="size-4 text-faint" />
                </button>
              );
            })}
          </nav>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setPage("home")}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-accent"
          >
            <ChevronLeft className="size-4" />
            Settings
          </button>
          <h1 className="text-2xl font-medium tracking-tight">{current?.label}</h1>
          <p className="mt-1 text-sm text-muted">{current?.hint}</p>
          <div className="mt-5">
            {page === "theme" ? <ThemePane /> : null}
            {page === "appearance" ? <AppearancePane /> : null}
            {page === "accent" ? <AccentPane /> : null}
            {page === "material" ? <MaterialPane /> : null}
            {page === "order" ? <HomeLayoutEditor plain /> : null}
            {page === "backup" ? <BackupPane /> : null}
            {page === "about" ? <AboutPane /> : null}
          </div>
        </>
      )}
    </div>
  );
}

function ThemePane() {
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
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const selected = appearance.mode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMode(mode.id)}
              className={cn(
                "rounded-xl border px-2.5 py-3 text-left",
                selected ? "border-accent bg-accent/10" : "border-border bg-subtle",
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
              <span className="mt-2 block text-sm font-medium">{mode.label}</span>
              <span className="text-xs text-faint">{mode.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={appearance.mode === "light"}
          onClick={() => setAppearance({ ...appearance, oled: !appearance.oled })}
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
            appearance.dynamic ? "border-accent bg-accent/10" : "border-border bg-subtle",
          )}
        >
          <span className="dynamic-preview block h-16 rounded-lg ring-1 ring-border" />
          <span className="mt-2 block text-sm font-medium">Dynamic</span>
          <span className="text-xs text-faint">From home banner</span>
        </button>
      </div>
    </section>
  );
}

function AppearancePane() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <label className="flex min-h-12 items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Bloom</span>
          <span className="text-xs text-faint">Soft accent glow on details banners</span>
        </span>
        <input
          type="checkbox"
          checked={appearance.bloom}
          onChange={(e) => setAppearance({ ...appearance, bloom: e.target.checked })}
          className="size-5 accent-[var(--color-accent)]"
        />
      </label>
      <label className="flex min-h-12 items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Grain</span>
          <span className="text-xs text-faint">Subtle film grain over the interface</span>
        </span>
        <input
          type="checkbox"
          checked={appearance.grain}
          onChange={(e) => setAppearance({ ...appearance, grain: e.target.checked })}
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
                    setAppearance({ ...appearance, grainIntensity: item.id })
                  }
                  className={cn(
                    "h-10 flex-1 rounded-full text-sm font-medium",
                    selected ? "bg-accent text-accent-fg" : "bg-subtle text-muted",
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
  );
}

function AccentPane() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <p className="text-xs text-faint">
        {appearance.dynamic
          ? "Preset chips are a fallback while Dynamic is on."
          : "Used when Dynamic is off."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACCENTS.map((swatch) => {
          const selected = !appearance.dynamic && appearance.accent === swatch.id;
          return (
            <button
              key={swatch.id}
              type="button"
              onClick={() =>
                setAppearance({ ...appearance, accent: swatch.id, dynamic: false })
              }
              className={cn(
                "flex h-11 items-center gap-2 rounded-full border px-3 text-sm",
                selected ? "border-accent bg-accent/10" : "border-border bg-subtle",
                appearance.dynamic && "opacity-60",
              )}
            >
              <span className="accent-chip size-4 rounded-full" data-chip={swatch.id} />
              {swatch.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MaterialPane() {
  return (
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-muted">
        Dynamic tints the cartridge mark, favicon, and chrome from the home banner.
        On Android 12+ the app also reads your wallpaper, and on Android 13+ the
        home-screen icon can follow Material You if Themed icons is enabled in
        wallpaper settings.
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-subtle px-3 py-3">
        <BrandMark className="size-10" />
        <p className="text-xs text-faint">Preview — the screen glow uses your current accent.</p>
      </div>
    </section>
  );
}

function AboutPane() {
  return (
    <section className="rounded-xl bg-elevated p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-muted">
        Video player, manga reader, extensions, liquid wallpaper, logo animation,
        and refresh-rate controls stay out of SaveState on purpose.
      </p>
    </section>
  );
}

async function backupRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function BackupPane() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"json" | "csv" | "import" | null>(null);

  if (isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (!user) {
    return (
      <section className="rounded-xl bg-elevated p-4 sm:p-5">
        <p className="text-sm text-muted">Sign in to export or restore your library.</p>
        <Link
          to="/login"
          className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Sign in
        </Link>
      </section>
    );
  }

  async function exportFile(kind: "json" | "csv") {
    setBusy(kind);
    try {
      const res = await backupRequest("/api/backup");
      if (!res.ok) throw new Error("Could not export");
      const backup = (await res.json()) as LibraryBackup;
      if (kind === "csv") {
        downloadText(backupFilename("csv"), backupToCsv(backup), "text/csv");
      } else {
        downloadText(
          backupFilename("json"),
          `${JSON.stringify(backup, null, 2)}\n`,
          "application/json",
        );
      }
      toast.success(`Saved ${backup.entries.length} games`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export");
    } finally {
      setBusy(null);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
      const res = await backupRequest("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { added?: number; updated?: number; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not import");
      void qc.invalidateQueries({ queryKey: libraryKey });
      toast.success(
        `Imported ${json.added ?? 0} new, updated ${json.updated ?? 0}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="space-y-3 rounded-xl bg-elevated p-4 sm:p-5">
      <p className="text-sm text-muted">
        Download a copy of your library, or restore from a previous SaveState file.
        Import merges by game — it does not delete anything already on this account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(busy)} onClick={() => void exportFile("json")}>
          {busy === "json" ? "Exporting…" : "Export JSON"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={Boolean(busy)}
          onClick={() => void exportFile("csv")}
        >
          {busy === "csv" ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          disabled={Boolean(busy)}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "import" ? "Importing…" : "Import JSON or CSV"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </div>
    </section>
  );
}
