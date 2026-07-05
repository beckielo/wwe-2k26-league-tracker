import type { WorkflowContextCandidate } from "./workflow-context";
import { LEAGUE_NAMES, type LeagueName, type SplitName, type StandingRow } from "./types";

export type CompletedSplitArchiveStatus = "confirmed" | "missing" | "not-archived";
export type CompletedSplitArchiveConfidence = "high" | "medium" | "low" | "conflicted";

export interface ScopedArchiveSource<T> {
  leagueYear: number;
  split: SplitName;
  status: CompletedSplitArchiveStatus;
  source: string;
  data: T;
}

export interface CompletedSplitHistoryInput {
  leagueYear: number;
  split: SplitName;
  completion: ScopedArchiveSource<{
    completedThroughYearWeek: number;
    completedAt: string | null;
  }>;
  finalStandings?: ScopedArchiveSource<StandingRow[]>;
  splitWinner?: ScopedArchiveSource<{ wrestler: string | null }>;
  leagueChampions?: ScopedArchiveSource<Array<{ league: LeagueName; wrestler: string }>>;
  leagueFinals?: ScopedArchiveSource<Array<{ event: string; result: string }>>;
  eliteCup?: ScopedArchiveSource<{ winner: string | null; runnerUp: string | null }>;
  movements?: ScopedArchiveSource<{ promoted: string[]; relegated: string[] }>;
  sourceSignature: string;
  sourceWorkbook: string | null;
  sourceCheckpoint: string;
  createdAt: string | null;
  confidence: CompletedSplitArchiveConfidence;
  conflicts?: string[];
  dataSource: string;
}

export interface CompletedSplitArchiveField<T> {
  status: CompletedSplitArchiveStatus;
  data: T;
  source: string | null;
}

export interface CompletedSplitHistoryRecord {
  version: 1;
  id: string;
  leagueYear: number;
  split: SplitName;
  splitStartYearWeek: number;
  splitEndYearWeek: number;
  completedThroughYearWeek: number;
  finalStandings: CompletedSplitArchiveField<StandingRow[]>;
  splitWinner: CompletedSplitArchiveField<string | null>;
  leagueChampions: CompletedSplitArchiveField<Array<{ league: LeagueName; wrestler: string }>>;
  leagueFinals: CompletedSplitArchiveField<Array<{ event: string; result: string }>>;
  eliteCup: CompletedSplitArchiveField<{ winner: string | null; runnerUp: string | null }>;
  movements: CompletedSplitArchiveField<{ promoted: string[]; relegated: string[] }>;
  sourceSignature: string;
  sourceWorkbook: string | null;
  sourceCheckpoint: string;
  createdAt: string | null;
  completedAt: string | null;
  confidence: CompletedSplitArchiveConfidence;
  conflicts: string[];
  dataSource: string;
}

function splitBounds(split: SplitName) {
  return split === "Opening Split"
    ? { start: 1, end: 24 }
    : { start: 25, end: 48 };
}

function isScoped<T>(
  source: ScopedArchiveSource<T> | undefined,
  leagueYear: number,
  split: SplitName,
): source is ScopedArchiveSource<T> {
  return Boolean(source && source.leagueYear === leagueYear && source.split === split);
}

function missingStatus<T>(source: ScopedArchiveSource<T> | undefined): CompletedSplitArchiveStatus {
  return source?.status === "missing" || source?.status === "confirmed" ? "missing" : "not-archived";
}

function completeFinalStandings(rows: StandingRow[]): boolean {
  return LEAGUE_NAMES.every((league) => {
    const leagueRows = rows.filter((row) => row.league === league);
    return leagueRows.length === 12
      && new Set(leagueRows.map((row) => row.wrestler)).size === 12
      && new Set(leagueRows.map((row) => row.rank)).size === 12;
  });
}

function completeLeagueChampions(records: Array<{ league: LeagueName; wrestler: string }>): boolean {
  return records.length === LEAGUE_NAMES.length
    && LEAGUE_NAMES.every((league) => records.filter((record) => record.league === league && record.wrestler.trim()).length === 1);
}

function scopedField<T>(
  source: ScopedArchiveSource<T> | undefined,
  leagueYear: number,
  split: SplitName,
  empty: T,
  validate: (data: T) => boolean = () => true,
): CompletedSplitArchiveField<T> {
  if (isScoped(source, leagueYear, split) && source.status === "confirmed" && validate(source.data)) {
    return { status: "confirmed", data: source.data, source: source.source };
  }
  return {
    status: missingStatus(source),
    data: empty,
    source: isScoped(source, leagueYear, split) ? source.source : null,
  };
}

export function createCompletedSplitHistoryRecord(
  input: CompletedSplitHistoryInput,
): CompletedSplitHistoryRecord | null {
  const bounds = splitBounds(input.split);
  if (
    !isScoped(input.completion, input.leagueYear, input.split)
    || input.completion.status !== "confirmed"
    || input.completion.data.completedThroughYearWeek < bounds.end
  ) {
    return null;
  }

  const conflicts = [...(input.conflicts ?? [])];
  const scopedSources = [
    input.finalStandings,
    input.splitWinner,
    input.leagueChampions,
    input.leagueFinals,
    input.eliteCup,
    input.movements,
  ] as Array<ScopedArchiveSource<unknown> | undefined>;
  for (const source of scopedSources) {
    if (!source) continue;
    if (source.leagueYear !== input.leagueYear || source.split !== input.split) {
      conflicts.push(`${source.source} was ignored because it belongs to another League Year or split.`);
    }
  }

  const finalStandings = scopedField(
    input.finalStandings,
    input.leagueYear,
    input.split,
    [],
    completeFinalStandings,
  );
  if (input.finalStandings?.status === "confirmed" && finalStandings.status !== "confirmed") {
    conflicts.push("Final standings were not archived because the supplied table was incomplete or belonged to another split.");
  }

  const splitWinner = scopedField(
    input.splitWinner,
    input.leagueYear,
    input.split,
    { wrestler: null },
    (data) => Boolean(data.wrestler?.trim()),
  );
  const leagueChampions = scopedField(
    input.leagueChampions,
    input.leagueYear,
    input.split,
    [],
    completeLeagueChampions,
  );
  if (input.leagueChampions?.status === "confirmed" && leagueChampions.status !== "confirmed") {
    conflicts.push("League champions were not archived because a complete four-league champion source was not available.");
  }

  return {
    version: 1,
    id: `completed-split:v1:y${input.leagueYear}:${input.split === "Opening Split" ? "opening" : "closing"}`,
    leagueYear: input.leagueYear,
    split: input.split,
    splitStartYearWeek: bounds.start,
    splitEndYearWeek: bounds.end,
    completedThroughYearWeek: input.completion.data.completedThroughYearWeek,
    finalStandings,
    splitWinner: {
      status: splitWinner.status,
      data: splitWinner.data.wrestler,
      source: splitWinner.source,
    },
    leagueChampions,
    leagueFinals: scopedField(input.leagueFinals, input.leagueYear, input.split, []),
    eliteCup: scopedField(
      input.eliteCup,
      input.leagueYear,
      input.split,
      { winner: null, runnerUp: null },
      (data) => Boolean(data.winner?.trim()),
    ),
    movements: scopedField(
      input.movements,
      input.leagueYear,
      input.split,
      { promoted: [], relegated: [] },
    ),
    sourceSignature: input.sourceSignature,
    sourceWorkbook: input.sourceWorkbook,
    sourceCheckpoint: input.sourceCheckpoint,
    createdAt: input.createdAt,
    completedAt: input.completion.data.completedAt,
    confidence: input.confidence,
    conflicts: [...new Set(conflicts)],
    dataSource: input.dataSource,
  };
}

export function buildCompletedSplitHistory(
  inputs: CompletedSplitHistoryInput[],
): CompletedSplitHistoryRecord[] {
  return inputs
    .map(createCompletedSplitHistoryRecord)
    .filter((record): record is CompletedSplitHistoryRecord => Boolean(record))
    .sort((a, b) => b.leagueYear - a.leagueYear || (b.split === "Closing Split" ? 1 : 0) - (a.split === "Closing Split" ? 1 : 0));
}

export function buildPrecedingSplitHistory(input: {
  currentContext: WorkflowContextCandidate;
  sourceWorkbook: string;
  confirmedEliteCupWinner?: {
    leagueYear: number;
    split: SplitName;
    wrestler: string;
    source: string;
  };
}): CompletedSplitHistoryRecord[] {
  if (!input.currentContext.valid) return [];
  const predecessor = input.currentContext.split === "Closing Split"
    ? { leagueYear: input.currentContext.leagueYear, split: "Opening Split" as const, completedThroughYearWeek: 24 }
    : input.currentContext.leagueYear > 1
      ? { leagueYear: input.currentContext.leagueYear - 1, split: "Closing Split" as const, completedThroughYearWeek: 48 }
      : null;
  if (!predecessor) return [];

  const eliteCup = input.confirmedEliteCupWinner
    && input.confirmedEliteCupWinner.leagueYear === predecessor.leagueYear
    && input.confirmedEliteCupWinner.split === predecessor.split
    ? {
        leagueYear: predecessor.leagueYear,
        split: predecessor.split,
        status: "confirmed" as const,
        source: input.confirmedEliteCupWinner.source,
        data: { winner: input.confirmedEliteCupWinner.wrestler, runnerUp: null },
      }
    : undefined;

  return buildCompletedSplitHistory([{
    ...predecessor,
    completion: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "confirmed",
      source: "Validated progression to the active split",
      data: {
        completedThroughYearWeek: predecessor.completedThroughYearWeek,
        completedAt: null,
      },
    },
    finalStandings: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "not-archived",
      source: "No confirmed final standings archive",
      data: [],
    },
    splitWinner: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "missing",
      source: "No confirmed split-winner source",
      data: { wrestler: null },
    },
    leagueChampions: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "missing",
      source: "No confirmed Finals/champion archive",
      data: [],
    },
    leagueFinals: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "not-archived",
      source: "No structured Finals results archive",
      data: [],
    },
    eliteCup,
    movements: {
      leagueYear: predecessor.leagueYear,
      split: predecessor.split,
      status: "not-archived",
      source: "No structured movement archive",
      data: { promoted: [], relegated: [] },
    },
    sourceSignature: `completed-split-history:v1:${input.currentContext.sourceSignature}:${predecessor.leagueYear}:${predecessor.split}`,
    sourceWorkbook: input.sourceWorkbook,
    sourceCheckpoint: `${input.currentContext.leagueYear}:${input.currentContext.split}:${input.currentContext.completedThroughYearWeek}`,
    createdAt: null,
    confidence: "medium",
    conflicts: [
      `${predecessor.split} is complete, but its league champions were not archived in a confirmed Finals/champion source.`,
    ],
    dataSource: "Validated workflow progression with separately confirmed historical facts",
  }]);
}
