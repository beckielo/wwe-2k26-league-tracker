import type { LeagueName } from "./types";

export const LEAGUE_VISUALS: Record<LeagueName, { key: string; shortName: string; monogram: string }> = {
  "Global League": { key: "global", shortName: "Global", monogram: "GL" },
  "Continental League": { key: "continental", shortName: "Continental", monogram: "CL" },
  "National League": { key: "national", shortName: "National", monogram: "NL" },
  "Regional League": { key: "regional", shortName: "Regional", monogram: "RL" },
};

export type PlacementZone = "rank-1" | "rank-2" | "rank-3" | "rank-4" | "mid-table" | "rank-9" | "rank-10" | "rank-11" | "rank-12";

export function placementZone(rank: number): PlacementZone {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  if (rank === 4) return "rank-4";
  if (rank >= 5 && rank <= 8) return "mid-table";
  if (rank === 9) return "rank-9";
  if (rank === 10) return "rank-10";
  if (rank === 11) return "rank-11";
  if (rank === 12) return "rank-12";
  throw new RangeError(`Standing rank must be between 1 and 12; received ${rank}.`);
}

export function placementLabel(league: LeagueName, rank: number): string {
  if (rank === 1) return league === "Global League" ? "Champion" : "Champion · Promotion";
  if (rank === 2) return league === "Global League" ? "Elite contender" : "Promotion contender";
  if (rank === 3) return "Contender zone";
  if (rank === 4) return "Final contender";
  if (rank >= 5 && rank <= 8) return "Mid-table";
  if (rank === 9) return "Danger zone";
  if (rank === 10) return "Relegation danger";
  if (rank === 11) return "Critical danger";
  return "Direct relegation";
}
