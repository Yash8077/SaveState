import type { CatalogGame, FeaturedRail, GameEntry } from '../models/types';

// Use 10.0.2.2 if testing on Android Emulator to connect to localhost:8080
// Pointing to your live Vercel deployment!
const BASE_URL = 'https://save-state-jade.vercel.app';

export async function searchGames(query: string): Promise<CatalogGame[]> {
  const res = await fetch(`${BASE_URL}/api/catalog/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search games');
  return res.json();
}

export async function getFeaturedRails(): Promise<FeaturedRail[]> {
  const res = await fetch(`${BASE_URL}/api/catalog/featured`);
  if (!res.ok) throw new Error('Failed to load featured rails');
  return res.json();
}

// In a real implementation you would pass auth cookies or tokens
export async function getLibrary(): Promise<GameEntry[]> {
  // Placeholder since it requires auth setup
  return [];
}
