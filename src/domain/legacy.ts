import * as XLSX from "xlsx";
import { sortLegacyProfiles, type LegacyProfile } from "./legacy-commentary";
import { LEAGUE_NAMES, type LeagueName, type StandingRow, type StreakRecord } from "./types";

type Cell = string | number | boolean | null | undefined;

export interface LegacyTableData {
  title: string;
  subtitle: string;
  policyNote: string;
  profiles: LegacyProfile[];
  columns: readonly string[];
  summary: LegacySummary;
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
  const sortedProfiles = sortLegacyProfiles(profiles);
  return {
    title: text(rows[0]?.[0]) || "Legacy Tracker",
    subtitle: text(rows[1]?.[0]),
    policyNote: text(rows[2]?.[0]),
    profiles: sortedProfiles,
    columns: LEGACY_COLUMNS,
    summary: summarizeLegacyProfiles(sortedProfiles),
  };
}

export interface LegacySummary {
  rankedProfiles: number;
  sourceTiers: number;
  leagueTitleRecords: number;
  eliteCupRecords: number;
  activeLegacyTiers: number;
  diagnostics: string[];
}

export function summarizeLegacyProfiles(profiles: LegacyProfile[]): LegacySummary {
  const leagueTitleRecords = profiles.reduce((sum, profile) => sum + profile.leagueWinsTotal, 0);
  const eliteCupRecords = profiles.reduce((sum, profile) => sum + profile.eliteCupWins, 0);
  const completedSplits = Math.max(Math.ceil(leagueTitleRecords / 4), eliteCupRecords);
  const expectedLeagueTitleRecords = completedSplits * 4;
  const diagnostics: string[] = [];
  if (completedSplits > 0 && leagueTitleRecords !== expectedLeagueTitleRecords) diagnostics.push(`Completed split title aggregation incomplete: expected ${expectedLeagueTitleRecords} league title records, found ${leagueTitleRecords}.`);
  if (completedSplits > 0 && eliteCupRecords !== completedSplits) diagnostics.push(`Completed split Elite Cup aggregation incomplete: expected ${completedSplits} Elite Cup winner records, found ${eliteCupRecords}.`);
  return {
    rankedProfiles: profiles.length,
    sourceTiers: profiles.filter((profile) => profile.goatStatusTier).length,
    leagueTitleRecords,
    eliteCupRecords,
    activeLegacyTiers: new Set(profiles.map((profile) => profile.legacyTier)).size,
    diagnostics,
  };
}

export interface EliteCupAggregation {
  completedSplits: number;
  expectedEliteCupRecords: number;
  winnerRecords: { split: string; wrestler: string }[];
  warnings: string[];
}

export function aggregateEliteCupHistory(records: { split: string; wrestler: string }[], completedSplits?: string[]): EliteCupAggregation {
  const splitNames = completedSplits ?? Array.from(new Set(records.map((record) => record.split)));
  const winnerRecords = splitNames.flatMap((split) => records.filter((record) => record.split === split).slice(0, 1));
  const warnings = splitNames.flatMap((split) => records.some((record) => record.split === split) ? [] : [`Completed split has no recorded Elite Cup winner: ${split}.`]);
  return {
    completedSplits: splitNames.length,
    expectedEliteCupRecords: splitNames.length,
    winnerRecords,
    warnings: winnerRecords.length === splitNames.length ? warnings : [...warnings, `Completed split Elite Cup aggregation incomplete: expected ${splitNames.length} Elite Cup winner records, found ${winnerRecords.length}.`],
  };
}

export interface LeagueTitleAggregation {
  completedSplits: number;
  expectedLeagueTitleRecords: number;
  titleRecords: { split: string; league: LeagueName; wrestler: string }[];
  warnings: string[];
}

export function aggregateLeagueTitleHistory(records: { split: string; league: LeagueName; wrestler: string }[]): LeagueTitleAggregation {
  const bySplit = new Map<string, { split: string; league: LeagueName; wrestler: string }[]>();
  for (const record of records) bySplit.set(record.split, [...(bySplit.get(record.split) ?? []), record]);
  const titleRecords: LeagueTitleAggregation["titleRecords"] = [];
  const warnings: string[] = [];
  for (const splitRecords of bySplit.values()) {
    const uniqueLeagues = new Set(splitRecords.map((record) => record.league));
    if (uniqueLeagues.size === 4) titleRecords.push(...splitRecords.filter((record, index, all) => all.findIndex((candidate) => candidate.league === record.league) === index));
    else warnings.push(`Completed split has incomplete league winner records: expected 4, found ${uniqueLeagues.size}.`);
  }
  const completedSplits = new Set(titleRecords.map((record) => record.split)).size;
  return {
    completedSplits,
    expectedLeagueTitleRecords: completedSplits * 4,
    titleRecords,
    warnings: titleRecords.length === completedSplits * 4 ? warnings : [...warnings, `Legacy title invariant failed: expected ${completedSplits * 4}, found ${titleRecords.length}.`],
  };
}

export function enrichLegacyProfilesWithCompletedSplitChampions(
  profiles: LegacyProfile[],
  championStandings: StandingRow[],
): LegacyProfile[] {
  const champions = championStandings.filter((row) => row.rank === 1 && /champion/i.test(row.status));
  if (new Set(champions.map((row) => row.league)).size !== 4) return profiles;
  const championNames = new Set(champions.map((row) => row.wrestler));
  return sortLegacyProfiles(profiles.map((profile) => ({
    ...profile,
    leagueWinsTotal: profile.leagueWinsTotal + (championNames.has(profile.wrestler) ? 1 : 0),
    globalChampionWins: profile.globalChampionWins + (champions.some((row) => row.league === "Global League" && row.wrestler === profile.wrestler) ? 1 : 0),
    checkpoints: { ...(profile.checkpoints ?? {}), previousSplitPosition: championNames.has(profile.wrestler) ? 1 : profile.checkpoints?.previousSplitPosition },
  })));
}

export function enrichLegacyProfilesFromCurrentMaster(
  profiles: LegacyProfile[],
  currentStandings: StandingRow[],
  currentStreaks: StreakRecord[],
): LegacyProfile[] {
  const leagueByWrestler = new Map(currentStandings.map((row) => [row.wrestler, row.league]));
  const finalPositionByWrestler = new Map(currentStandings.map((row) => [row.wrestler, row.rank]));
  const streakByWrestler = new Map(currentStreaks.map((row) => [row.wrestler, row.longestWinningStreak]));
  return sortLegacyProfiles(profiles.map((profile) => {
    const currentLeague = leagueByWrestler.get(profile.wrestler) ?? profile.currentLeague;
    const workbookLongest = streakByWrestler.get(profile.wrestler) ?? 0;
    const finalPosition = finalPositionByWrestler.get(profile.wrestler);
    return {
      ...profile,
      currentLeague,
      longestWinStreakOverall: Math.max(profile.longestWinStreakOverall, workbookLongest),
      checkpoints: finalPosition ? { ...(profile.checkpoints ?? {}), finalPosition } : profile.checkpoints,
    };
  }));
}
