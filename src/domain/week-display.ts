import type { SplitName } from "./types";

export interface WeekDisplay {
  split: SplitName;
  splitWeek: number;
  yearWeek: number;
  primary: string;
  compact: string;
  secondary: string;
}

export function getWeekDisplay(leagueYear: number, yearWeek: number, split?: SplitName): WeekDisplay {
  const resolvedSplit = split ?? (yearWeek > 24 ? "Closing Split" : "Opening Split");
  const splitWeek = resolvedSplit === "Closing Split" ? yearWeek - 24 : yearWeek;
  return {
    split: resolvedSplit,
    splitWeek,
    yearWeek,
    primary: `${resolvedSplit} Week ${splitWeek}`,
    compact: `${resolvedSplit} · Week ${splitWeek}`,
    secondary: `League Year ${leagueYear} · Year Week ${yearWeek}`,
  };
}

