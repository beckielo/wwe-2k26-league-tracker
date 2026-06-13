import { calculatePoints } from "./scoring";
import type { LeagueName, Match, StandingRow } from "./types";

export type ConfirmedResultType = "Winner" | "Draw" | "No Contest";
export type ConfirmedResultSource = "Manual" | "Simulation";

export interface ConfirmedResult {
  league: LeagueName;
  week: number;
  matchId: string;
  wrestlerA: string;
  wrestlerB: string;
  resultType: ConfirmedResultType;
  winner: string | null;
  source: ConfirmedResultSource;
  confirmedAt: string;
}

export interface CompletedWeek {
  week: number;
  completedAt: string;
}

export interface TrackerState {
  version: 1;
  confirmedResults: ConfirmedResult[];
  completedWeeks: CompletedWeek[];
  lastExportedAt: string | null;
  lastImportedAt: string | null;
}

export interface StateActionResult {
  ok: boolean;
  state: TrackerState;
  errors: string[];
}

export const TRACKER_STATE_STORAGE_KEY = "wwe-2k26-tracker-state-v1";

export function createEmptyTrackerState(): TrackerState {
  return { version: 1, confirmedResults: [], completedWeeks: [], lastExportedAt: null, lastImportedAt: null };
}

export function isWeekLocked(state: TrackerState, week: number): boolean {
  return state.completedWeeks.some((entry) => entry.week === week);
}

export function validateConfirmedResult(
  result: ConfirmedResult,
  scheduledMatches: Match[],
  userLeague: LeagueName,
): string[] {
  const errors: string[] = [];
  const match = scheduledMatches.find((candidate) => candidate.id === result.matchId);
  if (!match) return [`${result.matchId}: matchup is not in the authoritative schedule.`];
  if (result.league !== match.league || result.week !== match.week || result.wrestlerA !== match.wrestlerA || result.wrestlerB !== match.wrestlerB) {
    errors.push(`${result.matchId}: confirmed result does not match the scheduled matchup metadata.`);
  }
  if (result.source === "Simulation" && match.league === userLeague) {
    errors.push(`${result.matchId}: the user-controlled ${userLeague} cannot be simulated.`);
  }
  if (result.resultType === "Winner") {
    if (result.winner !== match.wrestlerA && result.winner !== match.wrestlerB) {
      errors.push(`${result.matchId}: winner must be one of the scheduled wrestlers.`);
    }
  } else if (result.winner !== null) {
    errors.push(`${result.matchId}: Draw or No Contest cannot have a winner.`);
  }
  if (!Number.isFinite(Date.parse(result.confirmedAt))) errors.push(`${result.matchId}: confirmedAt must be a valid timestamp.`);
  return errors;
}

export function confirmResult(
  state: TrackerState,
  result: ConfirmedResult,
  scheduledMatches: Match[],
  userLeague: LeagueName,
): StateActionResult {
  if (isWeekLocked(state, result.week)) return { ok: false, state, errors: [`Week ${result.week} is locked. Unlock it before editing results.`] };
  if (state.confirmedResults.some((entry) => entry.matchId === result.matchId)) {
    return { ok: false, state, errors: [`${result.matchId}: duplicate confirmed result.`] };
  }
  const errors = validateConfirmedResult(result, scheduledMatches, userLeague);
  if (errors.length) return { ok: false, state, errors };
  return { ok: true, errors: [], state: { ...state, confirmedResults: [...state.confirmedResults, result] } };
}

export function upsertResult(
  state: TrackerState,
  result: ConfirmedResult,
  scheduledMatches: Match[],
  userLeague: LeagueName,
): StateActionResult {
  if (isWeekLocked(state, result.week)) return { ok: false, state, errors: [`Week ${result.week} is locked. Unlock it before editing results.`] };
  const errors = validateConfirmedResult(result, scheduledMatches, userLeague);
  if (errors.length) return { ok: false, state, errors };
  const withoutCurrent = state.confirmedResults.filter((entry) => entry.matchId !== result.matchId);
  return { ok: true, errors: [], state: { ...state, confirmedResults: [...withoutCurrent, result] } };
}

export function removeResult(state: TrackerState, matchId: string): StateActionResult {
  const existing = state.confirmedResults.find((entry) => entry.matchId === matchId);
  if (!existing) return { ok: false, state, errors: [`${matchId}: confirmed result not found.`] };
  if (isWeekLocked(state, existing.week)) return { ok: false, state, errors: [`Week ${existing.week} is locked. Unlock it before removing results.`] };
  return { ok: true, errors: [], state: { ...state, confirmedResults: state.confirmedResults.filter((entry) => entry.matchId !== matchId) } };
}

export function validateWeekCompletion(
  state: TrackerState,
  week: number,
  scheduledMatches: Match[],
  userLeague: LeagueName,
): string[] {
  const weekMatches = scheduledMatches.filter((match) => match.week === week);
const weekResults = state.confirmedResults.filter(
(result) => result.week === week,
);
const resultByMatch = new Map(
weekResults.map((result) => [result.matchId, result]),
);
const errors: string[] = [];
const resultCounts = new Map<string, number>();

for (const result of weekResults) {
resultCounts.set(result.matchId, (resultCounts.get(result.matchId) ?? 0) + 1);
}

for (const [matchId, count] of resultCounts) {
if (count > 1) {
errors.push(matchId + ": duplicate confirmed results are not allowed.");
}
}

  if (weekMatches.length !== 24) errors.push(`Week ${week} has ${weekMatches.length} scheduled matches; expected 24.`);
  for (const match of weekMatches) {
    const result = resultByMatch.get(match.id);
    if (!result) errors.push(`${match.id}: confirmed result is missing.`);
    else errors.push(...validateConfirmedResult(result, scheduledMatches, userLeague));
  }
  for (const result of resultByMatch.values()) {
    if (!weekMatches.some((match) => match.id === result.matchId)) errors.push(`${result.matchId}: confirmed result is not part of Week ${week}.`);
  }
  return [...new Set(errors)];
}

export function completeWeek(
  state: TrackerState,
  week: number,
  scheduledMatches: Match[],
  userLeague: LeagueName,
  completedAt = new Date().toISOString(),
): StateActionResult {
  if (isWeekLocked(state, week)) return { ok: false, state, errors: [`Week ${week} is already complete and locked.`] };
  const errors = validateWeekCompletion(state, week, scheduledMatches, userLeague);
  if (errors.length) return { ok: false, state, errors };
  return { ok: true, errors: [], state: { ...state, completedWeeks: [...state.completedWeeks, { week, completedAt }] } };
}

export function unlockWeek(state: TrackerState, week: number): TrackerState {
  return { ...state, completedWeeks: state.completedWeeks.filter((entry) => entry.week !== week) };
}

export function calculateStandingsWithConfirmedResults(
  baseline: StandingRow[],
  scheduledMatches: Match[],
  confirmedResults: ConfirmedResult[],
): StandingRow[] {
  const rows = baseline.map((row) => ({ ...row }));
  const rowByKey = new Map(rows.map((row) => [`${row.league}:${row.wrestler}`, row]));
  const matchById = new Map(scheduledMatches.map((match) => [match.id, match]));

  for (const result of confirmedResults) {
    const match = matchById.get(result.matchId);
    if (!match) continue;
    const rowA = rowByKey.get(`${match.league}:${match.wrestlerA}`);
    const rowB = rowByKey.get(`${match.league}:${match.wrestlerB}`);
    if (!rowA || !rowB || result.resultType === "No Contest") continue;
    rowA.matches += 1;
    rowB.matches += 1;
    if (result.resultType === "Draw") {
      rowA.draws += 1;
      rowB.draws += 1;
    } else if (result.winner) {
      const winner = result.winner === match.wrestlerA ? rowA : rowB;
      const loser = result.winner === match.wrestlerA ? rowB : rowA;
      winner.wins += 1;
      loser.losses += 1;
    }
    rowA.points = calculatePoints(rowA.wins, rowA.draws);
    rowB.points = calculatePoints(rowB.wins, rowB.draws);
  }

  const leagueOrder = new Map<string, number>();
  for (const row of baseline) leagueOrder.set(`${row.league}:${row.wrestler}`, row.rank);
  const leagues = [...new Set(rows.map((row) => row.league))];
  return leagues.flatMap((league) => rows
    .filter((row) => row.league === league)
    .sort((a, b) => b.points - a.points || (leagueOrder.get(`${league}:${a.wrestler}`) ?? 99) - (leagueOrder.get(`${league}:${b.wrestler}`) ?? 99))
    .map((row, index) => ({ ...row, rank: index + 1 })));
}

export function exportTrackerState(state: TrackerState, exportedAt = new Date().toISOString()): { state: TrackerState; json: string } {
  const next = { ...state, lastExportedAt: exportedAt };
  return { state: next, json: JSON.stringify(next, null, 2) };
}

function isTrackerState(value: unknown): value is TrackerState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerState>;
  return candidate.version === 1 && Array.isArray(candidate.confirmedResults) && Array.isArray(candidate.completedWeeks);
}

export function importTrackerState(
  json: string,
  scheduledMatches: Match[],
  userLeague: LeagueName,
  importedAt = new Date().toISOString(),
): StateActionResult {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { ok: false, state: createEmptyTrackerState(), errors: ["Imported file is not valid JSON."] }; }
  if (!isTrackerState(parsed)) return { ok: false, state: createEmptyTrackerState(), errors: ["Imported JSON is not a supported tracker state file."] };
  const errors = parsed.confirmedResults.flatMap((result) => validateConfirmedResult(result, scheduledMatches, userLeague));
  const duplicateIds = parsed.confirmedResults.map((result) => result.matchId).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(...duplicateIds.map((id) => `${id}: duplicate confirmed result in imported state.`));
  for (const completed of parsed.completedWeeks) errors.push(...validateWeekCompletion(parsed, completed.week, scheduledMatches, userLeague));
  if (errors.length) return { ok: false, state: createEmptyTrackerState(), errors: [...new Set(errors)] };
  return { ok: true, errors: [], state: { ...parsed, lastImportedAt: importedAt } };
}

export function resetTrackerState(): TrackerState {
  return createEmptyTrackerState();
}
