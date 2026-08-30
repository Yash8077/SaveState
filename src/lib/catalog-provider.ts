export const CATALOG_PROVIDERS = ["igdb", "steam"] as const;

export type CatalogProvider = (typeof CATALOG_PROVIDERS)[number];

export const DEFAULT_CATALOG_PROVIDER: CatalogProvider = "igdb";

const KEY = "savestate-catalog-provider";

export const CATALOG_PROVIDER_META: Record<
  CatalogProvider,
  { label: string; hint: string; detail: string }
> = {
  igdb: {
    label: "IGDB",
    hint: "Covers & series",
    detail: "Prequels, sequels, DLC rails, and similar games.",
  },
  steam: {
    label: "Steam",
    hint: "Store catalog",
    detail: "New releases, coming soon, and what's selling.",
  },
};

export function parseCatalogProvider(raw: unknown): CatalogProvider {
  return raw === "steam" ? "steam" : "igdb";
}

export function loadCatalogProvider(): CatalogProvider {
  try {
    return parseCatalogProvider(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_CATALOG_PROVIDER;
  }
}

export function saveCatalogProvider(next: CatalogProvider) {
  localStorage.setItem(KEY, next);
}
