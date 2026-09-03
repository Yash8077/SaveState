export type WebActivity = {
  totals: { seconds: number; sessions: number; games: number; days: number };
  recent: Array<{
    titleId: string;
    titleName: string | null;
    createdDate: string;
    seconds: number;
    platform: "ps4" | "ps5";
    libraryGameId: number | null;
  }>;
  games: Array<{
    titleId: string;
    titleName: string;
    seconds: number;
    sessions: number;
    lastPlayed: string;
    platform: "ps4" | "ps5";
    libraryGameId: number | null;
  }>;
  daily: Array<{
    date: string;
    titleId: string;
    titleName: string;
    seconds: number;
    sessions: number;
    platform: "ps4" | "ps5";
  }>;
};

export async function getActivity(
  signal?: AbortSignal,
  month?: string,
): Promise<WebActivity> {
  const params = new URLSearchParams({ limit: "200" });
  if (month) params.set("month", month);
  const response = await fetch(`/api/activity?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Activity request failed: HTTP ${response.status}`);
  return (await response.json()) as WebActivity;
}
