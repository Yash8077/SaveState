export const STATUSES = [
  "playing",
  "beaten",
  "backlog",
  "hold",
  "dropped",
  "wishlist",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  playing: "Playing",
  beaten: "Beaten",
  backlog: "Backlog",
  hold: "On hold",
  dropped: "Dropped",
  wishlist: "Wishlist",
};

export type CatalogGame = {
  id: string;
  steamId: number | null;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  capsuleUrl: string | null;
  platforms: string[];
  metacritic: number | null;
};

export type FeaturedRail = {
  id: string;
  title: string;
  games: CatalogGame[];
};

export type CatalogDetails = CatalogGame & {
  summary: string;
  releaseDate: string | null;
  comingSoon: boolean;
  genres: string[];
  developers: string[];
  publishers: string[];
  screenshots: string[];
  website: string | null;
  related: FeaturedRail[];
};

export type GameEntry = {
  id: number;
  catalogId: string;
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  summary: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  metacritic: number | null;
  developers: string[];
  publishers: string[];
  screenshots: string[];
  status: Status;
  score: number | null;
  hours: number | null;
  favorite: boolean;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryPage = {
  items: GameEntry[];
  nextCursor: string | null;
};

export type LibrarySnapshot = {
  title: string;
  coverUrl: string | null;
  headerUrl: string | null;
  summary: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  metacritic: number | null;
  developers: string[];
  publishers: string[];
  screenshots: string[];
};
