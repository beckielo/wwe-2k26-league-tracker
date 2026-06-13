import {
  isWeekLocked,
  validateConfirmedResult,
  type ConfirmedResult,
  type TrackerState,
} from "./tracker-state";
import type { LeagueName, Match } from "./types";

export type WeekCompletionStatus = "incomplete" | "complete-unlocked" | "locked";

export interface WeekProgress {
  week: number;
  total: number;
  confirmed: number;
  missing: number;
  manual: number;
  simulation: number;
  invalid: number;
  locked: boolean;
  status: WeekCompletionStatus;
  missingMatches: Match[];
  confirmedResults: ConfirmedResult[];
  validationErrors: string[];
}

export interface ActiveWeekResolution {
  activeWeek: number | null;
  seasonComplete: boolean;
  scheduledWeeks: number[];
  latestLockedWeek: number | null;
}

export function getWorkflowScheduledWeeks(matches: Match[], workbookCurrentWeek: number): number[] {
  return [...new Set(
    matches
      .filter((match) => match.status === "scheduled" && match.week > workbookCurrentWeek)
      .map((match) => match.week),
  )].sort((a, b) => a - b);
}

export function detectActiveWeek(
  state: TrackerState,
  matches: Match[],
  workbookCurrentWeek: number,
): ActiveWeekResolution {
  const scheduledWeeks = getWorkflowScheduledWeeks(matches, workbookCurrentWeek);
  const activeWeek = scheduledWeeks.find((week) => !isWeekLocked(state, week)) ?? null;
  const lockedScheduledWeeks = scheduledWeeks.filter((week) => isWeekLocked(state, week));

  return {
    activeWeek,
    seasonComplete: activeWeek === null,
    scheduledWeeks,
    latestLockedWeek: lockedScheduledWeeks.at(-1) ?? null,
  };
}

export function getWeekProgress(
  state: TrackerState,
  week: number,
  scheduledMatches: Match[],
  userLeague: LeagueName,
): WeekProgress {
  const weekMatches = scheduledMatches
    .filter((match) => match.week === week && match.status === "scheduled")
    .sort((a, b) => a.league.localeCompare(b.league) || a.matchNumber - b.matchNumber);
  const scheduledIds = new Set(weekMatches.map((match) => match.id));
  const weekResults = state.confirmedResults.filter((result) => result.week === week);
  const resultCounts = new Map<string, number>();

  for (const result of weekResults) {
    resultCounts.set(result.matchId, (resultCounts.get(result.matchId) ?? 0) + 1);
  }

  const validationErrors: string[] = [];
  if (weekMatches.length !== 24) {
    validationErrors.push(`Week ${week} has ${weekMatches.length} scheduled matches; expected 24.`);
  }

  const validByMatch = new Map<string, ConfirmedResult>();
  for (const result of weekResults) {
    if (!scheduledIds.has(result.matchId)) {
      validationErrors.push(`${result.matchId}: confirmed result is not part of authoritative Week ${week}.`);
      continue;
    }
    if ((resultCounts.get(result.matchId) ?? 0) > 1) {
      validationErrors.push(`${result.matchId}: duplicate confirmed results are not allowed.`);
      continue;
    }
    const errors = validateConfirmedResult(result, scheduledMatches, userLeague);
    if (errors.length > 0) validationErrors.push(...errors);
    else validByMatch.set(result.matchId, result);
  }

  const missingMatches = weekMatches.filter((match) => !validByMatch.has(match.id));
  const confirmedResults = [...validByMatch.values()];
  const locked = isWeekLocked(state, week);
  const complete = weekMatches.length === 24 && missingMatches.length === 0 && validationErrors.length === 0;

  return {
    week,
    total: weekMatches.length,
    confirmed: confirmedResults.length,
    missing: missingMatches.length,
    manual: confirmedResults.filter((result) => result.source === "Manual").length,
    simulation: confirmedResults.filter((result) => result.source === "Simulation").length,
    invalid: validationErrors.length,
    locked,
    status: locked ? "locked" : complete ? "complete-unlocked" : "incomplete",
    missingMatches,
    confirmedResults,
    validationErrors: [...new Set(validationErrors)],
  };
}

export function getActiveUserLeagueMatches(
  state: TrackerState,
  matches: Match[],
  workbookCurrentWeek: number,
  userLeague: LeagueName,
): Match[] {
  const { activeWeek } = detectActiveWeek(state, matches, workbookCurrentWeek);
  if (activeWeek === null) return [];
  return matches
    .filter((match) => match.status === "scheduled" && match.week === activeWeek && match.league === userLeague)
    .sort((a, b) => a.matchNumber - b.matchNumber);
}
