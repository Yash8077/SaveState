import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Database, Store } from "lucide-react";
import {
  CATALOG_PROVIDER_META,
  CATALOG_PROVIDERS,
  DEFAULT_CATALOG_PROVIDER,
  loadCatalogProvider,
  saveCatalogProvider,
  type CatalogProvider,
} from "@/lib/catalog-provider";
import { cn } from "@/lib/utils";

const CatalogContext = createContext<{
  provider: CatalogProvider;
  setProvider: (next: CatalogProvider) => void;
}>({
  provider: DEFAULT_CATALOG_PROVIDER,
  setProvider: () => {},
});

export function CatalogProviderGate({ children }: { children: ReactNode }) {
  const [provider, setState] = useState<CatalogProvider>(
    DEFAULT_CATALOG_PROVIDER,
  );

  useEffect(() => {
    setState(loadCatalogProvider());
  }, []);

  const setProvider = useCallback((next: CatalogProvider) => {
    setState(next);
    saveCatalogProvider(next);
  }, []);

  const value = useMemo(
    () => ({ provider, setProvider }),
    [provider, setProvider],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalogSource() {
  return useContext(CatalogContext);
}

const ICONS = {
  igdb: Database,
  steam: Store,
} as const;

export function CatalogSourceSwitch({
  size = "compact",
}: {
  size?: "compact" | "cards";
}) {
  const { provider, setProvider } = useCatalogSource();

  if (size === "cards") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {CATALOG_PROVIDERS.map((id) => {
          const meta = CATALOG_PROVIDER_META[id];
          const selected = provider === id;
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left",
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-subtle",
              )}
            >
              <Icon className="size-5 text-accent" />
              <span className="mt-2 block text-sm font-medium">
                {meta.label}
              </span>
              <span className="text-xs text-faint">{meta.hint}</span>
              <span className="mt-1 block text-xs text-muted">
                {meta.detail}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="inline-flex rounded-full bg-subtle p-1">
      {CATALOG_PROVIDERS.map((id) => {
        const selected = provider === id;
        const Icon = ICONS[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => setProvider(id)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
              selected ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            <Icon className="size-3.5" />
            {CATALOG_PROVIDER_META[id].label}
          </button>
        );
      })}
    </div>
  );
}
