import type { TrophyRow } from "@/lib/api";

export type TrophySort = "default" | "not-earned" | "earned-date" | "grade";

export const TROPHY_SORTS: { id: TrophySort; label: string }[] = [
  { id: "default", label: "Game Default" },
  { id: "not-earned", label: "Not Earned" },
  { id: "earned-date", label: "Earned Date (New - Old)" },
  { id: "grade", label: "Grade (Platinum - Bronze)" },
];

function gradeRank(type: string | null | undefined) {
  switch (type) {
    case "platinum":
      return 0;
    case "gold":
      return 1;
    case "silver":
      return 2;
    case "bronze":
      return 3;
    default:
      return 4;
  }
}

function earnedAt(row: TrophyRow) {
  if (!row.earned || !row.earned_at) return 0;
  const t = Date.parse(row.earned_at);
  return Number.isFinite(t) ? t : 0;
}

export function sortTrophies(trophies: TrophyRow[], sort: TrophySort): TrophyRow[] {
  if (sort === "default") return trophies;

  return trophies
    .map((trophy, index) => ({ trophy, index }))
    .sort((a, b) => {
      if (sort === "not-earned") {
        const ae = a.trophy.earned ? 1 : 0;
        const be = b.trophy.earned ? 1 : 0;
        if (ae !== be) return ae - be;
      } else if (sort === "earned-date") {
        const at = earnedAt(a.trophy);
        const bt = earnedAt(b.trophy);
        if (at !== bt) return bt - at;
      } else if (sort === "grade") {
        const ag = gradeRank(a.trophy.trophy_type);
        const bg = gradeRank(b.trophy.trophy_type);
        if (ag !== bg) return ag - bg;
      }
      return a.index - b.index;
    })
    .map((row) => row.trophy);
}
