import * as XLSX from "xlsx";
import { sortLegacyProfiles, type LegacyProfile } from "./legacy-commentary";
import { LEAGUE_NAMES, type LeagueName, type SplitName, type StandingRow, type StreakRecord } from "./types";

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
  audit?: LegacyCompletedSplitAudit;
}

export interface LegacySourceAudit { source: string; leagueTitleRecords: number; eliteCupRecords: number; notes: string[]; }
export interface LegacyCompletedSplitAudit {
  detectedCompletedSplits: string[];
  leagueTitleRecords: LegacyTitleRecord[];
  eliteCupRecords: LegacyEliteCupRecord[];
  duplicateRecordsRemoved: number;
  sources: LegacySourceAudit[];
  diagnostics: string[];
}


export function summarizeLegacyProfiles(profiles: LegacyProfile[], audit?: LegacyCompletedSplitAudit): LegacySummary {
  const leagueTitleRecords = profiles.reduce((sum, profile) => sum + profile.leagueWinsTotal, 0);
  const eliteCupRecords = profiles.reduce((sum, profile) => sum + profile.eliteCupWins, 0);
  const completedSplits = Math.max(Math.ceil(leagueTitleRecords / 4), eliteCupRecords);
  const expectedLeagueTitleRecords = completedSplits * 4;
  const diagnostics: string[] = [...(audit?.diagnostics ?? [])];
  if (completedSplits > 0 && leagueTitleRecords !== expectedLeagueTitleRecords) diagnostics.push(`Completed split title aggregation incomplete: expected ${expectedLeagueTitleRecords} league title records, found ${leagueTitleRecords}.`);
  if (completedSplits > 0 && eliteCupRecords !== completedSplits) diagnostics.push(`Completed split Elite Cup aggregation incomplete: expected ${completedSplits} Elite Cup winner records, found ${eliteCupRecords}.`);
  return {
    rankedProfiles: profiles.length,
    sourceTiers: profiles.filter((profile) => profile.goatStatusTier).length,
    leagueTitleRecords,
    eliteCupRecords,
    activeLegacyTiers: new Set(profiles.map((profile) => profile.legacyTier)).size,
    diagnostics: Array.from(new Set(diagnostics)),
    audit,
  };
}

export interface EliteCupAggregation {
  completedSplits: number;
  expectedEliteCupRecords: number;
  winnerRecords: LegacyEliteCupRecord[];
  warnings: string[];
}

export interface LegacyTitleRecord {
  leagueYear: number;
  split: SplitName | string;
  league: LeagueName;
  wrestler: string;
  sourceLabel?: string;
}

export interface LegacyEliteCupRecord {
  leagueYear: number;
  split: SplitName | string;
  eventName: string;
  wrestler: string;
  sourceLabel?: string;
}

type LooseEliteCupRecord = Partial<LegacyEliteCupRecord> & { split: string; wrestler: string };

function normalizedIdentity(...parts: (string | number | undefined)[]): string {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join("||");
}

function normalizeTitleRecord(record: Partial<LegacyTitleRecord> & { split: string; league: LeagueName; wrestler: string }): LegacyTitleRecord {
  return {
    leagueYear: record.leagueYear ?? 1,
    split: record.split,
    league: record.league,
    wrestler: record.wrestler,
    sourceLabel: record.sourceLabel,
  };
}

function normalizeEliteCupRecord(record: LooseEliteCupRecord): LegacyEliteCupRecord {
  return {
    leagueYear: record.leagueYear ?? 1,
    split: record.split,
    eventName: record.eventName ?? "Global Elite Cup",
    wrestler: record.wrestler,
    sourceLabel: record.sourceLabel,
  };
}

export function aggregateEliteCupHistory(records: LooseEliteCupRecord[], completedSplits?: string[]): EliteCupAggregation {
  const deduped = Array.from(new Map(records.map((record) => {
    const normalized = normalizeEliteCupRecord(record);
    return [normalizedIdentity(normalized.leagueYear, normalized.split, normalized.eventName, normalized.wrestler), normalized] as const;
  })).values());
  const splitNames = completedSplits ?? Array.from(new Set(deduped.map((record) => `${record.leagueYear}:${record.split}`)));
  const winnerRecords = splitNames.flatMap((splitName) => {
    const [yearPrefix, ...splitParts] = splitName.includes(":") ? splitName.split(":") : [];
    const wantedYear = yearPrefix ? Number(yearPrefix) : null;
    const wantedSplit = yearPrefix ? splitParts.join(":") : splitName;
    return deduped.filter((record) => record.split === wantedSplit && (wantedYear === null || record.leagueYear === wantedYear)).slice(0, 1);
  });
  const warnings = splitNames.flatMap((splitName) => {
    const [yearPrefix, ...splitParts] = splitName.includes(":") ? splitName.split(":") : [];
    const wantedYear = yearPrefix ? Number(yearPrefix) : null;
    const wantedSplit = yearPrefix ? splitParts.join(":") : splitName;
    return deduped.some((record) => record.split === wantedSplit && (wantedYear === null || record.leagueYear === wantedYear)) ? [] : ["Completed split Elite Cup record missing."];
  });
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
  titleRecords: LegacyTitleRecord[];
  warnings: string[];
}

export function aggregateLeagueTitleHistory(records: (Partial<LegacyTitleRecord> & { split: string; league: LeagueName; wrestler: string })[]): LeagueTitleAggregation {
  const deduped = Array.from(new Map(records.map((record) => {
    const normalized = normalizeTitleRecord(record);
    return [normalizedIdentity(normalized.leagueYear, normalized.split, normalized.league, normalized.wrestler), normalized] as const;
  })).values());
  const bySplit = new Map<string, LegacyTitleRecord[]>();
  for (const record of deduped) {
    const splitKey = normalizedIdentity(record.leagueYear, record.split);
    bySplit.set(splitKey, [...(bySplit.get(splitKey) ?? []), record]);
  }
  const titleRecords: LeagueTitleAggregation["titleRecords"] = [];
  const warnings: string[] = [];
  for (const splitRecords of bySplit.values()) {
    const uniqueLeagues = new Set(splitRecords.map((record) => record.league));
    if (uniqueLeagues.size === 4) titleRecords.push(...splitRecords.filter((record, index, all) => all.findIndex((candidate) => candidate.league === record.league) === index));
    else warnings.push(`Completed split title aggregation incomplete: expected 4 league title records, found ${uniqueLeagues.size}.`);
  }
  const completedSplits = new Set(titleRecords.map((record) => normalizedIdentity(record.leagueYear, record.split))).size;
  return {
    completedSplits,
    expectedLeagueTitleRecords: completedSplits * 4,
    titleRecords,
    warnings: titleRecords.length === completedSplits * 4 ? warnings : [...warnings, `Legacy title invariant failed: expected ${completedSplits * 4}, found ${titleRecords.length}.`],
  };
}

export interface LegacyCompletedSplitSource {
  source: string;
  completedSplits?: string[];
  titleRecords?: (Partial<LegacyTitleRecord> & { split: string; league: LeagueName; wrestler: string })[];
  eliteCupRecords?: LooseEliteCupRecord[];
  notes?: string[];
}

export function auditLegacyCompletedSplitSources(sources: LegacyCompletedSplitSource[]): LegacyCompletedSplitAudit {
  const checkedSources = sources.map((source) => ({
    source: source.source,
    leagueTitleRecords: source.titleRecords?.length ?? 0,
    eliteCupRecords: source.eliteCupRecords?.length ?? 0,
    notes: source.notes ?? [],
  }));
  const detectedCompletedSplits = Array.from(new Set(sources.flatMap((source) => source.completedSplits ?? [])));
  const detectedSplitSet = new Set(detectedCompletedSplits);
  const isDetected = (record: { leagueYear?: number; split: string }) => detectedSplitSet.size === 0 || detectedSplitSet.has(`${record.leagueYear ?? 1}:${record.split}`) || detectedSplitSet.has(record.split);
  const rawTitleRecords = sources.flatMap((source) => source.titleRecords ?? []).filter(isDetected);
  const rawCupRecords = sources.flatMap((source) => source.eliteCupRecords ?? []).filter(isDetected);
  const titleAggregation = aggregateLeagueTitleHistory(rawTitleRecords);
  const cupAggregation = aggregateEliteCupHistory(rawCupRecords, detectedCompletedSplits);
  const completedSplitCount = Math.max(detectedCompletedSplits.length, titleAggregation.completedSplits, cupAggregation.completedSplits);
  const expectedLeagueTitleRecords = completedSplitCount * 4;
  const expectedEliteCupRecords = completedSplitCount;
  const duplicateRecordsRemoved = rawTitleRecords.length + rawCupRecords.length - titleAggregation.titleRecords.length - cupAggregation.winnerRecords.length;
  const diagnostics = [...titleAggregation.warnings, ...cupAggregation.warnings];
  if (completedSplitCount > 0 && titleAggregation.titleRecords.length !== expectedLeagueTitleRecords) {
    diagnostics.push(`Legacy aggregation incomplete: detected ${completedSplitCount} completed splits, expected ${expectedLeagueTitleRecords} league title records and ${expectedEliteCupRecords} Elite Cup records, found ${titleAggregation.titleRecords.length} and ${cupAggregation.winnerRecords.length}. Missing source: completed split/Post-Finals records not fully ingested.`);
  } else if (completedSplitCount > 0 && cupAggregation.winnerRecords.length !== expectedEliteCupRecords) {
    diagnostics.push(`Legacy aggregation incomplete: detected ${completedSplitCount} completed splits, expected ${expectedLeagueTitleRecords} league title records and ${expectedEliteCupRecords} Elite Cup records, found ${titleAggregation.titleRecords.length} and ${cupAggregation.winnerRecords.length}. Missing source: completed Elite Cup event result not fully ingested.`);
  }
  return {
    detectedCompletedSplits,
    leagueTitleRecords: titleAggregation.titleRecords,
    eliteCupRecords: cupAggregation.winnerRecords,
    duplicateRecordsRemoved,
    sources: checkedSources,
    diagnostics: Array.from(new Set(diagnostics)),
  };
}

export function applyLegacyHistoryRecords(
  profiles: LegacyProfile[],
  titleRecords: LegacyTitleRecord[],
  eliteCupRecords: LegacyEliteCupRecord[],
): LegacyProfile[] {
  const titleCounts = new Map<string, number>();
  const globalCounts = new Map<string, number>();
  const cupCounts = new Map<string, number>();
  for (const record of aggregateLeagueTitleHistory(titleRecords).titleRecords) {
    titleCounts.set(record.wrestler, (titleCounts.get(record.wrestler) ?? 0) + 1);
    if (record.league === "Global League") globalCounts.set(record.wrestler, (globalCounts.get(record.wrestler) ?? 0) + 1);
  }
  for (const record of aggregateEliteCupHistory(eliteCupRecords).winnerRecords) {
    cupCounts.set(record.wrestler, (cupCounts.get(record.wrestler) ?? 0) + 1);
  }
  return sortLegacyProfiles(profiles.map((profile) => ({
    ...profile,
    leagueWinsTotal: Math.max(profile.leagueWinsTotal, titleCounts.get(profile.wrestler) ?? 0),
    globalChampionWins: Math.max(profile.globalChampionWins, globalCounts.get(profile.wrestler) ?? 0),
    eliteCupWins: Math.max(profile.eliteCupWins, cupCounts.get(profile.wrestler) ?? 0),
  })));
}

export function extractCompletedSplitTitleRecordsFromFinalStandings(
  standings: StandingRow[],
  leagueYear: number,
  split: SplitName,
  sourceLabel: string,
): { titleRecords: LegacyTitleRecord[]; warnings: string[] } {
  const championRows = standings.filter((row) => row.rank === 1 && /champion/i.test(row.status));
  const byLeague = new Map(championRows.map((row) => [row.league, row]));
  if (byLeague.size !== 4) {
    return { titleRecords: [], warnings: [`Completed split title aggregation incomplete: expected 4 league title records, found ${byLeague.size}.`] };
  }
  return {
    titleRecords: LEAGUE_NAMES.map((leagueName) => ({ leagueYear, split, league: leagueName, wrestler: byLeague.get(leagueName)!.wrestler, sourceLabel })),
    warnings: [],
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
