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

export type WorkflowAction =
| "result-entry"
| "simulation"
| "week-review"
| "tiebreaker-review"
| "league-finals"
| "complete";

export interface LeagueWeekProgress {
league: LeagueName;
scheduled: number;
confirmed: number;
missing: number;
}

export interface WorkflowSummary {
workbookCompletedThroughWeek: number;
activeWeek: number | null;
latestLockedWeek: number | null;
userLeague: LeagueName;
seasonComplete: boolean;
progress: WeekProgress | null;
userLeagueProgress: LeagueWeekProgress | null;
nonUserLeagueProgress: LeagueWeekProgress[];
recommendedAction: WorkflowAction;
recommendedHref: "/" | "/results" | "/simulation" | "/week-review" | "/league-finals";
recommendedLabel: string;
recommendedReason: string;
}

export function getCompletedRegularSplitWeek(state: TrackerState, workbookCurrentWeek: number): number {
  const latestLockedWeek = [...state.completedWeeks].sort((a, b) => b.week - a.week)[0]?.week ?? null;
  const effectiveYearWeek = Math.max(workbookCurrentWeek, latestLockedWeek ?? workbookCurrentWeek);
  return state.activeWorkflow?.split === "Closing Split" ? Math.max(0, effectiveYearWeek - 24) : effectiveYearWeek;
}

export function isRegularSeasonComplete(state: TrackerState, workbookCurrentWeek: number): boolean {
  return getCompletedRegularSplitWeek(state, workbookCurrentWeek) >= 22;
}

export function getNextWorkflowPhaseAfterWeek22(hasRelevantTiebreakers: boolean | null): { action: WorkflowAction; href: WorkflowSummary["recommendedHref"]; label: string; reason: string } {
  if (hasRelevantTiebreakers === false) {
    return {
      action: "league-finals",
      href: "/league-finals",
      label: "Prepare League Finals",
      reason: "Regular season complete. No normal weekly card remains before League Finals.",
    };
  }
  return {
    action: "tiebreaker-review",
    href: "/week-review",
    label: "Regular season complete. Next phase: Tiebreaker Review.",
    reason: "No normal Week 23 card will be generated. Review and resolve any consequential ties before League Finals.",
  };
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
export function getWorkflowSummary(
state: TrackerState,
matches: Match[],
workbookCurrentWeek: number,
userLeague: LeagueName,
): WorkflowSummary {
const resolution = detectActiveWeek(state, matches, workbookCurrentWeek);
const effectiveCompletedThroughWeek = Math.max(
workbookCurrentWeek,
resolution.latestLockedWeek ?? workbookCurrentWeek,
);

if (isRegularSeasonComplete(state, workbookCurrentWeek) && resolution.activeWeek === null) {
const nextPhase = getNextWorkflowPhaseAfterWeek22(null);
return {
workbookCompletedThroughWeek: effectiveCompletedThroughWeek,
activeWeek: null,
latestLockedWeek: resolution.latestLockedWeek,
userLeague,
seasonComplete: false,
progress: null,
userLeagueProgress: null,
nonUserLeagueProgress: [],
recommendedAction: nextPhase.action,
recommendedHref: nextPhase.href,
recommendedLabel: nextPhase.label,
recommendedReason: nextPhase.reason,
};
}

if (resolution.activeWeek === null) {
return {
workbookCompletedThroughWeek: workbookCurrentWeek,
activeWeek: null,
latestLockedWeek: resolution.latestLockedWeek,
userLeague,
seasonComplete: true,
progress: null,
userLeagueProgress: null,
nonUserLeagueProgress: [],
recommendedAction: "complete",
recommendedHref: "/",
recommendedLabel: "Season workflow complete",
recommendedReason: "No later authoritative scheduled week remains.",
};
}

const activeWeek = resolution.activeWeek;
const progress = getWeekProgress(state, activeWeek, matches, userLeague);
const confirmedIds = new Set(
progress.confirmedResults.map((result) => result.matchId),
);

const activeMatches = matches.filter(
(match) => match.status === "scheduled" && match.week === activeWeek,
);

const leagueProgress = [...new Set(activeMatches.map((match) => match.league))]
.map((league): LeagueWeekProgress => {
const leagueMatches = activeMatches.filter(
(match) => match.league === league,
);
const confirmed = leagueMatches.filter((match) =>
confirmedIds.has(match.id),
).length;

  return {
    league,
    scheduled: leagueMatches.length,
    confirmed,
    missing: leagueMatches.length - confirmed,
  };
});

const userLeagueProgress =
leagueProgress.find((entry) => entry.league === userLeague) ?? null;
const nonUserLeagueProgress = leagueProgress.filter(
(entry) => entry.league !== userLeague,
);

if ((userLeagueProgress?.missing ?? 0) > 0) {
return {
workbookCompletedThroughWeek: workbookCurrentWeek,
activeWeek,
latestLockedWeek: resolution.latestLockedWeek,
userLeague,
seasonComplete: false,
progress,
userLeagueProgress,
nonUserLeagueProgress,
recommendedAction: "result-entry",
recommendedHref: "/results",
recommendedLabel: "Enter user-league results",
recommendedReason:
(userLeagueProgress?.missing ?? 0) +
" " +
userLeague +
" matches still need confirmed results.",
};
}

const nonUserMissing = nonUserLeagueProgress.reduce(
(total, entry) => total + entry.missing,
0,
);

if (nonUserMissing > 0) {
return {
workbookCompletedThroughWeek: workbookCurrentWeek,
activeWeek,
latestLockedWeek: resolution.latestLockedWeek,
userLeague,
seasonComplete: false,
progress,
userLeagueProgress,
nonUserLeagueProgress,
recommendedAction: "simulation",
recommendedHref: "/simulation",
recommendedLabel: "Simulate non-user leagues",
recommendedReason:
nonUserMissing + " non-user league matches still need confirmed results.",
};
}

return {
workbookCompletedThroughWeek: workbookCurrentWeek,
activeWeek,
latestLockedWeek: resolution.latestLockedWeek,
userLeague,
seasonComplete: false,
progress,
userLeagueProgress,
nonUserLeagueProgress,
recommendedAction: "week-review",
recommendedHref: "/week-review",
recommendedLabel: "Review and lock week",
recommendedReason:
"All " +
progress.confirmed +
" authoritative results are valid and Week " +
activeWeek +
" is ready to lock.",
};
}
