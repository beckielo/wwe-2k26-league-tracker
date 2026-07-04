import { calculateWinningStreaks } from "./tiebreakers";
import type {
  HeadToHeadRecord,
  LeagueName,
  Match,
  MatchResult,
  SplitName,
  StandingRow,
  StreakRecord,
} from "./types";
import { LEAGUE_NAMES } from "./types";
import { createWorkflowSourceSignature } from "./workflow-context";

export type HistoricalAnalyticsSheetStatus = "current" | "reconstructed";

export interface HistoricalAnalyticsContext {
  leagueYear: number;
  split: SplitName;
  completedThroughYearWeek: number;
  completedThroughSplitWeek: number;
  activeYearWeek: number;
  activeSplitWeek: number;
  sourceSignature: string;
  sourceLabel: string;
  resultCount: number;
  decisiveCount: number;
  drawCount: number;
  noContestCount: number;
  rejectedResultCount: number;
  ignoredContextResultCount: number;
}

export interface HistoricalAnalyticsAudit extends HistoricalAnalyticsContext {
  headToHeadSheetStatus: HistoricalAnalyticsSheetStatus;
  winningStreakSheetStatus: HistoricalAnalyticsSheetStatus;
}

export interface CurrentHistoricalAnalytics {
  headToHead: HeadToHeadRecord[];
  streaks: StreakRecord[];
  context: HistoricalAnalyticsContext;
}

interface CurrentHistoricalAnalyticsInput {
  matches: Match[];
  results: MatchResult[];
  standings: StandingRow[];
  leagueYear: number;
  split: SplitName;
  completedThroughYearWeek: number;
  authoritySourceSignature: string;
}

function splitWeek(split: SplitName, yearWeek: number): number {
  return split === "Closing Split" ? yearWeek - 24 : yearWeek;
}

function leagueOrder(league: LeagueName): number {
  return LEAGUE_NAMES.indexOf(league);
}

function validResultForMatch(result: MatchResult, match: Match): boolean {
  if (result.outcome === "decisive") {
    return result.winner === match.wrestlerA || result.winner === match.wrestlerB;
  }
  if (result.outcome === "draw" || result.outcome === "no-contest") {
    return result.winner === null;
  }
  return false;
}

export function deriveCurrentHistoricalAnalytics(
  input: CurrentHistoricalAnalyticsInput,
): CurrentHistoricalAnalytics {
  const contextMatches = input.matches.filter((match) => (
    match.leagueYear === input.leagueYear
    && match.split === input.split
    && match.week <= input.completedThroughYearWeek
  ));
  const allMatchesById = new Map(input.matches.map((match) => [match.id, match]));
  const contextMatchesById = new Map(contextMatches.map((match) => [match.id, match]));
  const seenResultIds = new Set<string>();
  const acceptedResults: MatchResult[] = [];
  let rejectedResultCount = 0;
  let ignoredContextResultCount = 0;

  for (const result of input.results) {
    const sourceMatch = allMatchesById.get(result.matchId);
    const contextMatch = contextMatchesById.get(result.matchId);
    if (sourceMatch && !contextMatch) {
      ignoredContextResultCount += 1;
      continue;
    }
    if (
      !contextMatch
      || seenResultIds.has(result.matchId)
      || !validResultForMatch(result, contextMatch)
    ) {
      rejectedResultCount += 1;
      continue;
    }
    seenResultIds.add(result.matchId);
    acceptedResults.push(result);
  }

  const matchById = new Map(contextMatches.map((match) => [match.id, match]));
  const orderedResults = acceptedResults
    .map((result) => ({ result, match: matchById.get(result.matchId)! }))
    .sort((left, right) => (
      left.match.week - right.match.week
      || leagueOrder(left.match.league) - leagueOrder(right.match.league)
      || left.match.matchNumber - right.match.matchNumber
      || left.match.id.localeCompare(right.match.id)
    ));

  const headToHead = orderedResults.flatMap(({ result, match }): HeadToHeadRecord[] => {
    if (result.outcome === "no-contest") return [];
    const winner = result.outcome === "decisive" ? result.winner ?? "" : "";
    return [{
      league: match.league,
      week: splitWeek(match.split, match.week),
      roundType: match.roundType,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      winner,
      loser: winner
        ? (winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA)
        : "",
    }];
  });

  const calculatedStreaks = calculateWinningStreaks(contextMatches, acceptedResults);
  const calculatedByWrestler = new Map(calculatedStreaks.map((row) => [
    `${row.league}:${row.wrestler}`,
    row,
  ]));
  const lastResultByWrestler = new Map<string, StreakRecord["lastResult"]>();
  for (const { result, match } of orderedResults) {
    if (result.outcome === "no-contest") continue;
    const keyA = `${match.league}:${match.wrestlerA}`;
    const keyB = `${match.league}:${match.wrestlerB}`;
    if (result.outcome === "draw") {
      lastResultByWrestler.set(keyA, "D");
      lastResultByWrestler.set(keyB, "D");
      continue;
    }
    lastResultByWrestler.set(keyA, result.winner === match.wrestlerA ? "W" : "L");
    lastResultByWrestler.set(keyB, result.winner === match.wrestlerB ? "W" : "L");
  }

  const completedThroughSplitWeek = splitWeek(input.split, input.completedThroughYearWeek);
  const profileKeys = new Set([
    ...input.standings.map((row) => `${row.league}:${row.wrestler}`),
    ...calculatedStreaks.map((row) => `${row.league}:${row.wrestler}`),
  ]);
  const standingByKey = new Map(input.standings.map((row) => [
    `${row.league}:${row.wrestler}`,
    row,
  ]));
  const streaks = [...profileKeys].map((key): StreakRecord => {
    const standing = standingByKey.get(key);
    const calculated = calculatedByWrestler.get(key);
    const [league, ...wrestlerParts] = key.split(":");
    return {
      league: (standing?.league ?? calculated?.league ?? league) as LeagueName,
      wrestler: standing?.wrestler ?? calculated?.wrestler ?? wrestlerParts.join(":"),
      seed: standing?.seed ?? 0,
      currentStreak: calculated?.currentWinningStreak ?? 0,
      longestWinningStreak: calculated?.longestWinningStreak ?? 0,
      lastResult: lastResultByWrestler.get(key) ?? "",
      notes: `${input.split} Week ${completedThroughSplitWeek} completed · validated workflow context`,
    };
  }).sort((left, right) => (
    leagueOrder(left.league) - leagueOrder(right.league)
    || left.seed - right.seed
    || left.wrestler.localeCompare(right.wrestler)
  ));

  const decisiveCount = acceptedResults.filter((result) => result.outcome === "decisive").length;
  const drawCount = acceptedResults.filter((result) => result.outcome === "draw").length;
  const noContestCount = acceptedResults.filter((result) => result.outcome === "no-contest").length;
  const sourceSignature = createWorkflowSourceSignature([
    "historical-analytics",
    input.authoritySourceSignature,
    input.leagueYear,
    input.split,
    input.completedThroughYearWeek,
    ...orderedResults.flatMap(({ result, match }) => [
      match.id,
      match.leagueYear,
      match.split,
      match.week,
      result.outcome,
      result.winner,
    ]),
  ]);

  return {
    headToHead,
    streaks,
    context: {
      leagueYear: input.leagueYear,
      split: input.split,
      completedThroughYearWeek: input.completedThroughYearWeek,
      completedThroughSplitWeek,
      activeYearWeek: input.completedThroughYearWeek + 1,
      activeSplitWeek: completedThroughSplitWeek + 1,
      sourceSignature,
      sourceLabel: "WorkflowContextAuthority + validated schedule results",
      resultCount: acceptedResults.length,
      decisiveCount,
      drawCount,
      noContestCount,
      rejectedResultCount,
      ignoredContextResultCount,
    },
  };
}

function canonicalHeadToHead(records: HeadToHeadRecord[]): string[] {
  return records.map((record) => [
    record.league,
    record.week,
    record.roundType,
    record.wrestlerA,
    record.wrestlerB,
    record.winner,
    record.loser,
  ].join("|")).sort();
}

function canonicalStreaks(records: StreakRecord[]): string[] {
  return records.map((record) => [
    record.league,
    record.wrestler,
    record.seed,
    record.currentStreak,
    record.longestWinningStreak,
    record.lastResult,
    record.notes ?? "",
  ].join("|")).sort();
}

export function historicalAnalyticsSheetStatus(
  workbookHeadToHead: HeadToHeadRecord[],
  workbookStreaks: StreakRecord[],
  analytics: CurrentHistoricalAnalytics,
): Pick<HistoricalAnalyticsAudit, "headToHeadSheetStatus" | "winningStreakSheetStatus"> {
  return {
    headToHeadSheetStatus: JSON.stringify(canonicalHeadToHead(workbookHeadToHead))
      === JSON.stringify(canonicalHeadToHead(analytics.headToHead))
      ? "current"
      : "reconstructed",
    winningStreakSheetStatus: JSON.stringify(canonicalStreaks(workbookStreaks))
      === JSON.stringify(canonicalStreaks(analytics.streaks))
      ? "current"
      : "reconstructed",
  };
}
