import type { ConfirmedResult } from "./tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type SplitName, type StandingRow } from "./types";
import { createWorkflowSourceSignature } from "./workflow-context";

export type ClosingCheckpointProvenance =
  | "committed-weekly-workbooks"
  | "browser-local"
  | "qa-fixture";

export interface ClosingCheckpointCandidate {
  id: string;
  leagueYear: number;
  split: SplitName;
  completedThroughYearWeek: number;
  writebackCompletedAt: string;
  scheduleSource: "accepted generated snapshot" | "accepted imported snapshot";
  schedule: Match[];
  results: ConfirmedResult[];
  lockedWeeks: number[];
  provenance: ClosingCheckpointProvenance;
}

export interface ClosingCheckpointEvaluation {
  candidateId: string;
  leagueYear: number;
  split: SplitName;
  completedThroughYearWeek: number;
  splitWeek: number;
  writebackCompletedAt: string;
  resultCount: number;
  lockedWeekCount: number;
  coherent: boolean;
  promotable: boolean;
  confidence: "high" | "conflicted";
  sourceSignature: string;
  standings: StandingRow[];
  errors: string[];
  warnings: string[];
}

export interface ClosingCheckpointSelection {
  selected: ClosingCheckpointEvaluation | null;
  evaluations: ClosingCheckpointEvaluation[];
  reason: string;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function expectedWeeks(completedThroughYearWeek: number): number[] {
  return Array.from({ length: Math.max(0, completedThroughYearWeek - 24) }, (_, index) => index + 25);
}

function duplicateValues(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function deriveSeeds(schedule: Match[], errors: string[]): Map<string, number> {
  const seeds = new Map<string, number>();
  for (const league of LEAGUE_NAMES) {
    const weekOne = schedule
      .filter((match) => match.league === league && match.week === 25)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    if (weekOne.length !== 6 || weekOne.some((match, index) => match.matchNumber !== index + 1)) {
      errors.push(`${league} Closing Week 1 does not contain match numbers 1–6 for seed reconstruction.`);
      continue;
    }
    for (const match of weekOne) {
      seeds.set(`${league}:${normalized(match.wrestlerA)}`, match.matchNumber);
      seeds.set(`${league}:${normalized(match.wrestlerB)}`, 13 - match.matchNumber);
    }
  }
  return seeds;
}

function reconstructStandings(
  schedule: Match[],
  results: ConfirmedResult[],
  completedThroughYearWeek: number,
  errors: string[],
): StandingRow[] {
  const seeds = deriveSeeds(schedule, errors);
  const wrestlersByLeague = new Map<LeagueName, string[]>(
    LEAGUE_NAMES.map((league) => [league, []]),
  );
  for (const match of schedule) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const roster = wrestlersByLeague.get(match.league)!;
      if (!roster.some((candidate) => normalized(candidate) === normalized(wrestler))) roster.push(wrestler);
    }
  }

  const splitWeek = completedThroughYearWeek - 24;
  const rows = LEAGUE_NAMES.flatMap((league) => wrestlersByLeague.get(league)!.map((wrestler): StandingRow => ({
    league,
    rank: 0,
    wrestler,
    seed: seeds.get(`${league}:${normalized(wrestler)}`) ?? 99,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: `Closing Split Week ${splitWeek} · reconstructed from committed weekly results`,
  })));
  const rowByKey = new Map(rows.map((row) => [`${row.league}:${normalized(row.wrestler)}`, row]));
  const matchById = new Map(schedule.map((match) => [match.id, match]));

  for (const result of results) {
    const match = matchById.get(result.matchId);
    if (!match) continue;
    const rowA = rowByKey.get(`${match.league}:${normalized(match.wrestlerA)}`);
    const rowB = rowByKey.get(`${match.league}:${normalized(match.wrestlerB)}`);
    if (!rowA || !rowB) continue;
    rowA.matches += 1;
    rowB.matches += 1;
    if (result.resultType === "Draw" || result.resultType === "No Contest") {
      rowA.draws += 1;
      rowB.draws += 1;
    } else if (result.winner) {
      const winner = normalized(result.winner) === normalized(match.wrestlerA) ? rowA : rowB;
      const loser = winner === rowA ? rowB : rowA;
      winner.wins += 1;
      loser.losses += 1;
    }
    rowA.points = rowA.wins * 3 + rowA.draws;
    rowB.points = rowB.wins * 3 + rowB.draws;
  }

  return LEAGUE_NAMES.flatMap((league) => rows
    .filter((row) => row.league === league)
    .sort((a, b) => b.points - a.points || a.seed - b.seed)
    .map((row, index) => ({ ...row, rank: index + 1 })));
}

export function evaluateClosingCheckpoint(candidate: ClosingCheckpointCandidate): ClosingCheckpointEvaluation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const completedWeeks = expectedWeeks(candidate.completedThroughYearWeek);
  const splitWeek = candidate.completedThroughYearWeek - 24;
  const sortedLocks = [...candidate.lockedWeeks].sort((a, b) => a - b);

  if (candidate.split !== "Closing Split") errors.push("Candidate is not a Closing Split checkpoint.");
  if (!Number.isInteger(candidate.leagueYear) || candidate.leagueYear < 1) errors.push("Candidate League Year is invalid.");
  if (candidate.completedThroughYearWeek < 25 || candidate.completedThroughYearWeek > 46) {
    errors.push("Closing checkpoint must end in regular Year Weeks 25–46.");
  }
  if (!Number.isFinite(Date.parse(candidate.writebackCompletedAt))) errors.push("Writeback completion timestamp is invalid.");
  if (candidate.scheduleSource !== "accepted generated snapshot") {
    errors.push("This reconstruction requires the persisted generated schedule seed order.");
  }

  const scheduleIds = candidate.schedule.map((match) => match.id);
  if (candidate.schedule.length !== 528) errors.push(`Schedule has ${candidate.schedule.length} matches; expected 528.`);
  if (duplicateValues(scheduleIds).length > 0) errors.push("Schedule contains duplicate match IDs.");
  if (candidate.schedule.some((match) => (
    match.leagueYear !== candidate.leagueYear || match.split !== candidate.split
  ))) errors.push("Schedule mixes League Year or Split contexts.");

  for (const week of Array.from({ length: 22 }, (_, index) => index + 25)) {
    if (candidate.schedule.filter((match) => match.week === week).length !== 24) {
      errors.push(`Schedule Week ${week} does not contain exactly 24 matches.`);
    }
  }
  for (const league of LEAGUE_NAMES) {
    const leagueWrestlers = new Set(candidate.schedule
      .filter((match) => match.league === league)
      .flatMap((match) => [normalized(match.wrestlerA), normalized(match.wrestlerB)]));
    if (leagueWrestlers.size !== 12) errors.push(`${league} schedule roster does not contain exactly 12 wrestlers.`);
  }

  if (
    sortedLocks.length !== completedWeeks.length
    || sortedLocks.some((week, index) => week !== completedWeeks[index])
  ) errors.push("Locked weeks are not contiguous from Year Week 25 through the candidate checkpoint.");

  const expectedResultCount = completedWeeks.length * 24;
  const resultIds = candidate.results.map((result) => result.matchId);
  if (candidate.results.length !== expectedResultCount) {
    errors.push(`Candidate has ${candidate.results.length} results; expected ${expectedResultCount}.`);
  }
  if (duplicateValues(resultIds).length > 0) errors.push("Candidate contains duplicate result IDs.");

  const matchById = new Map(candidate.schedule.map((match) => [match.id, match]));
  for (const result of candidate.results) {
    const match = matchById.get(result.matchId);
    if (
      !match
      || result.week !== match.week
      || result.league !== match.league
      || result.wrestlerA !== match.wrestlerA
      || result.wrestlerB !== match.wrestlerB
      || result.week > candidate.completedThroughYearWeek
      || (result.resultType === "Winner" && result.winner !== match.wrestlerA && result.winner !== match.wrestlerB)
      || (result.resultType !== "Winner" && result.winner !== null)
    ) errors.push(`${result.matchId} does not match the candidate schedule context.`);
  }
  for (const week of completedWeeks) {
    if (candidate.results.filter((result) => result.week === week).length !== 24) {
      errors.push(`Result evidence for Week ${week} is not a complete 24-match card.`);
    }
  }

  if (candidate.provenance !== "committed-weekly-workbooks") {
    warnings.push(`${candidate.provenance} evidence is not independently persistent and cannot be promoted.`);
  }

  const standings = errors.length
    ? []
    : reconstructStandings(
      candidate.schedule,
      candidate.results,
      candidate.completedThroughYearWeek,
      errors,
    );
  if (standings.length > 0 && standings.some((row) => (
    row.matches !== splitWeek
    || row.matches !== row.wins + row.draws + row.losses
    || row.points !== row.wins * 3 + row.draws
  ))) errors.push("Reconstructed standings records are internally inconsistent.");

  const sourceSignature = createWorkflowSourceSignature([
    "closing-checkpoint",
    candidate.leagueYear,
    candidate.split,
    candidate.completedThroughYearWeek,
    candidate.writebackCompletedAt,
    candidate.scheduleSource,
    candidate.provenance,
    ...candidate.schedule.slice().sort((a, b) => a.id.localeCompare(b.id))
      .flatMap((match) => [match.id, match.week, match.league, match.wrestlerA, match.wrestlerB]),
    ...candidate.results.slice().sort((a, b) => a.matchId.localeCompare(b.matchId))
      .flatMap((result) => [result.matchId, result.week, result.resultType, result.winner, result.confirmedAt]),
    sortedLocks.join(","),
  ]);
  const coherent = errors.length === 0;
  const promotable = coherent && candidate.provenance === "committed-weekly-workbooks";

  return {
    candidateId: candidate.id,
    leagueYear: candidate.leagueYear,
    split: candidate.split,
    completedThroughYearWeek: candidate.completedThroughYearWeek,
    splitWeek,
    writebackCompletedAt: candidate.writebackCompletedAt,
    resultCount: candidate.results.length,
    lockedWeekCount: sortedLocks.length,
    coherent,
    promotable,
    confidence: promotable ? "high" : "conflicted",
    sourceSignature,
    standings,
    errors: [...new Set(errors)],
    warnings,
  };
}

export function selectClosingCheckpoint(candidates: ClosingCheckpointCandidate[]): ClosingCheckpointSelection {
  const evaluations = candidates.map(evaluateClosingCheckpoint);
  const eligible = evaluations.filter((candidate) => candidate.promotable).sort((a, b) => (
    Date.parse(b.writebackCompletedAt) - Date.parse(a.writebackCompletedAt)
    || b.completedThroughYearWeek - a.completedThroughYearWeek
  ));
  if (eligible.length === 0) {
    return {
      selected: null,
      evaluations,
      reason: "No coherent persistent Closing Split checkpoint is available; use the workbook fallback.",
    };
  }
  const [selected, runnerUp] = eligible;
  if (
    runnerUp
    && runnerUp.writebackCompletedAt === selected.writebackCompletedAt
    && runnerUp.sourceSignature !== selected.sourceSignature
  ) {
    return {
      selected: null,
      evaluations,
      reason: "Multiple conflicting coherent checkpoints have the same latest timestamp.",
    };
  }
  return {
    selected,
    evaluations,
    reason: `Selected ${selected.candidateId}: newest coherent persistent checkpoint by chronological writeback.`,
  };
}
