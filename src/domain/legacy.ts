import * as XLSX from "xlsx";
import type { LegacyProfile } from "./legacy-commentary";
import { LEAGUE_NAMES, type LeagueName, type StandingRow, type StreakRecord } from "./types";

type Cell = string | number | boolean | null | undefined;

export interface LegacyTableData {
  title: string;
  subtitle: string;
  policyNote: string;
  profiles: LegacyProfile[];
  columns: readonly string[];
}

export const LEGACY_COLUMNS = [
  "Wrestler",
  "Current League",
  "GOAT Status Tier",
  "League Wins Total",
  "Global Champion Wins",
  "Elite Cup Wins",
  "Doubles",
  "Invincible Splits",
  "Invincible Hinrunden",
  "Invincible Rückrunden",
  "Longest Win Streak Overall",
  "Journalist / GOAT Case Notes",
] as const;

function text(value: Cell): string {
  return value == null ? "" : String(value).trim();
}

function count(value: Cell): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseLegacyTracker(workbook: XLSX.WorkBook): LegacyTableData {
  const sheet = workbook.Sheets.Legacy_Tracker;
  if (!sheet) throw new Error("Required workbook sheet is missing: Legacy_Tracker");
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => text(row[0]) === "Wrestler");
  if (headerIndex < 0) throw new Error("Legacy_Tracker does not contain a Wrestler header.");
  const headers = rows[headerIndex].map(text);
  for (const column of LEGACY_COLUMNS) {
    if (!headers.includes(column)) throw new Error(`Legacy_Tracker is missing the existing column: ${column}`);
  }
  const profiles = rows.slice(headerIndex + 1).flatMap((row): LegacyProfile[] => {
    const wrestler = text(row[0]);
    if (!wrestler) return [];
    const currentLeague = text(row[1]);
    if (!LEAGUE_NAMES.includes(currentLeague as LeagueName)) return [];
    return [{
      wrestler,
      currentLeague: currentLeague as LeagueName,
      goatStatusTier: text(row[2]) || null,
      leagueWinsTotal: count(row[3]),
      globalChampionWins: count(row[4]),
      eliteCupWins: count(row[5]),
      doubles: count(row[6]),
      invincibleSplits: count(row[7]),
      invincibleHinrunden: count(row[8]),
      invincibleRueckrunden: count(row[9]),
      longestWinStreakOverall: count(row[10]),
      sourceCommentary: text(row[11]) || null,
    }];
  });
  return {
    title: text(rows[0]?.[0]) || "Legacy Tracker",
    subtitle: text(rows[1]?.[0]),
    policyNote: text(rows[2]?.[0]),
    profiles,
    columns: LEGACY_COLUMNS,
  };
}

export function enrichLegacyProfilesFromCurrentMaster(
  profiles: LegacyProfile[],
  currentStandings: StandingRow[],
  currentStreaks: StreakRecord[],
): LegacyProfile[] {
  const leagueByWrestler = new Map(currentStandings.map((row) => [row.wrestler, row.league]));
  const finalPositionByWrestler = new Map(currentStandings.map((row) => [row.wrestler, row.rank]));
  const streakByWrestler = new Map(currentStreaks.map((row) => [row.wrestler, row.longestWinningStreak]));
  return profiles.map((profile) => {
    const currentLeague = leagueByWrestler.get(profile.wrestler) ?? profile.currentLeague;
    const workbookLongest = streakByWrestler.get(profile.wrestler) ?? 0;
    const finalPosition = finalPositionByWrestler.get(profile.wrestler);
    return {
      ...profile,
      currentLeague,
      longestWinStreakOverall: Math.max(profile.longestWinStreakOverall, workbookLongest),
      checkpoints: finalPosition ? { ...(profile.checkpoints ?? {}), finalPosition } : profile.checkpoints,
    };
  });
}
