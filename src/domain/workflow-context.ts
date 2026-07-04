import type { ConfirmedResult, TrackerState } from "./tracker-state";
import type { LeagueName, Match, SplitName, StandingRow } from "./types";

export type WorkflowContextPhase =
  | "setup"
  | "regular-season"
  | "week-review"
  | "split-complete"
  | "finals"
  | "post-finals"
  | "transition"
  | "unknown";

export type WorkflowContextSource = "local" | "app-workbook" | "workbook-dashboard";
export type WorkflowContextConfidence = "high" | "medium" | "low" | "conflicted";
export type WorkflowFinalsReadiness = "ready" | "not-ready" | "stale" | "invalid" | "unknown";

export interface WorkflowContextConflict {
  code: string;
  severity: "warning" | "error";
  message: string;
  sources: WorkflowContextSource[];
  recommendedAction: string;
}

export interface WorkflowScheduleIdentity {
  id: string;
  leagueYear: number;
  split: SplitName;
  week: number;
  league: LeagueName;
  wrestlerA: string;
  wrestlerB: string;
}

export interface WorkflowContextCandidate {
  source: WorkflowContextSource;
  valid: boolean;
  leagueYear: number;
  split: SplitName;
  activeYearWeek: number;
  completedThroughYearWeek: number;
  splitWeek: number;
  phase: WorkflowContextPhase;
  scheduleSource: string;
  standingsSource: string;
  resultsSource: string;
  finalsReadiness: WorkflowFinalsReadiness;
  sourceSignature: string;
  confidence: WorkflowContextConfidence;
  conflicts: WorkflowContextConflict[];
}

export interface WorkflowContextBaseline {
  dashboard: WorkflowContextCandidate;
  appWorkbook: WorkflowContextCandidate | null;
  selected: WorkflowContextSource;
  schedule: WorkflowScheduleIdentity[];
  conflicts: WorkflowContextConflict[];
}

export interface WorkflowContextAuthority extends Omit<WorkflowContextCandidate, "valid"> {
  activeSource: WorkflowContextSource;
  localStateAccepted: boolean;
  blockingConflicts: WorkflowContextConflict[];
  diagnosticNotices: WorkflowContextConflict[];
  rejectedSources: WorkflowContextSource[];
}

export function scopeTrackerStateToAuthority(
  state: TrackerState,
  localStateAccepted: boolean,
): TrackerState {
  if (localStateAccepted) return state;
  return {
    ...state,
    confirmedResults: [],
    completedWeeks: [],
    acceptedSchedule: undefined,
    activeWorkflow: undefined,
    completedSplitLegacyCommits: [],
    lastCompletedAchievementMetadata: null,
    championMetadataAudit: undefined,
  };
}

export interface AppWorkbookContextInput {
  latestWriteback: { week: number; completedAt: string } | null;
  schedule: Match[];
  standings: StandingRow[] | null;
  results: ConfirmedResult[];
}

const SOURCE_PRIORITY: Record<WorkflowContextSource, number> = {
  local: 3,
  "app-workbook": 2,
  "workbook-dashboard": 1,
};

function conflict(
  code: string,
  message: string,
  sources: WorkflowContextSource[],
  recommendedAction: string,
  severity: WorkflowContextConflict["severity"] = "error",
): WorkflowContextConflict {
  return { code, message, sources, recommendedAction, severity };
}

function splitStart(split: SplitName): number {
  return split === "Closing Split" ? 25 : 1;
}

function splitWeek(split: SplitName, yearWeek: number): number {
  return split === "Closing Split" ? yearWeek - 24 : yearWeek;
}

function phaseFor(completedThroughYearWeek: number, activeYearWeek: number, split: SplitName): WorkflowContextPhase {
  const completedSplitWeek = splitWeek(split, completedThroughYearWeek);
  const activeSplitWeek = splitWeek(split, activeYearWeek);
  if (completedSplitWeek >= 24) return "post-finals";
  if (activeSplitWeek >= 24) return "finals";
  if (completedSplitWeek >= 22 || activeSplitWeek >= 23) return "split-complete";
  return completedThroughYearWeek < splitStart(split) ? "setup" : "regular-season";
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function createWorkflowSourceSignature(parts: Array<string | number | boolean | null | undefined>): string {
  return `workflow-${hash(parts.map((part) => `${part ?? ""}`).join("|"))}`;
}

export function scheduleIdentity(matches: Match[]): WorkflowScheduleIdentity[] {
  return matches.map((match) => ({
    id: match.id,
    leagueYear: match.leagueYear,
    split: match.split,
    week: match.week,
    league: match.league,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
  }));
}

function scheduleSignature(schedule: WorkflowScheduleIdentity[]): string {
  return createWorkflowSourceSignature(schedule
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((match) => [match.id, match.leagueYear, match.split, match.week, match.league, match.wrestlerA, match.wrestlerB]));
}

function standingsSignature(standings: StandingRow[]): string {
  return createWorkflowSourceSignature(standings
    .slice()
    .sort((a, b) => a.league.localeCompare(b.league) || a.rank - b.rank)
    .flatMap((row) => [row.league, row.rank, row.wrestler, row.matches, row.points]));
}

function resultsSignature(results: ConfirmedResult[]): string {
  return createWorkflowSourceSignature(results
    .slice()
    .sort((a, b) => a.matchId.localeCompare(b.matchId))
    .flatMap((result) => [result.matchId, result.week, result.resultType, result.winner, result.confirmedAt]));
}

function acceptedScheduleSignature(state: TrackerState): string | null {
  const accepted = state.acceptedSchedule;
  if (!accepted) return null;
  const identity: WorkflowScheduleIdentity[] = accepted.matches.map((match) => ({
    id: match.id,
    leagueYear: match.leagueYear,
    split: match.split,
    week: match.yearWeek ?? match.splitWeek + (match.split === "Closing Split" ? 24 : 0),
    league: match.league,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
  }));
  return createWorkflowSourceSignature([
    "accepted-schedule",
    accepted.leagueYear,
    accepted.split,
    accepted.acceptedAt,
    accepted.source,
    scheduleSignature(identity),
  ]);
}

export function signLocalWorkflowContext(
  state: TrackerState,
  baselineSourceSignature: string,
  signedAt = new Date().toISOString(),
): TrackerState {
  const hasLocalWorkflowEvidence = Boolean(state.activeWorkflow)
    || state.confirmedResults.length > 0
    || state.completedWeeks.length > 0;
  if (!hasLocalWorkflowEvidence) {
    if (!state.workflowContextCheckpoint) return state;
    return { ...state, workflowContextCheckpoint: undefined };
  }
  return {
    ...state,
    workflowContextCheckpoint: {
      scope: "user-workflow",
      baselineSourceSignature,
      acceptedScheduleSignature: acceptedScheduleSignature(state),
      signedAt,
    },
  };
}

function scheduleContext(schedule: WorkflowScheduleIdentity[], week: number): { leagueYear: number; split: SplitName } | null {
  const weekMatches = schedule.filter((match) => match.week === week);
  const years = new Set(weekMatches.map((match) => match.leagueYear));
  const splits = new Set(weekMatches.map((match) => match.split));
  if (weekMatches.length !== 24 || years.size !== 1 || splits.size !== 1) return null;
  return { leagueYear: weekMatches[0].leagueYear, split: weekMatches[0].split };
}

function validateStandingsComposition(
  standings: StandingRow[],
  schedule: WorkflowScheduleIdentity[],
  leagueYear: number,
  split: SplitName,
  completedThroughYearWeek?: number,
): string[] {
  const errors: string[] = [];
  if (standings.length !== 48) errors.push(`Expected 48 standings rows, found ${standings.length}.`);
  const activeSchedule = schedule.filter((match) => match.leagueYear === leagueYear && match.split === split);
  const leagueByWrestler = new Map<string, LeagueName>();
  for (const match of activeSchedule) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const key = wrestler.trim().toLocaleLowerCase();
      const existing = leagueByWrestler.get(key);
      if (existing && existing !== match.league) errors.push(`${wrestler} appears in multiple schedule leagues.`);
      leagueByWrestler.set(key, match.league);
    }
  }
  for (const row of standings) {
    const scheduledLeague = leagueByWrestler.get(row.wrestler.trim().toLocaleLowerCase());
    if (!scheduledLeague || scheduledLeague !== row.league) {
      errors.push(`${row.wrestler} standings league does not match the active schedule.`);
    }
  }
  const expectedMatches = completedThroughYearWeek === undefined
    ? null
    : splitWeek(split, completedThroughYearWeek);
  if (expectedMatches !== null && expectedMatches >= 0 && expectedMatches <= 22) {
    const mismatchedRecords = standings.filter((row) => row.matches !== expectedMatches);
    if (mismatchedRecords.length > 0) {
      errors.push(`${mismatchedRecords.length} standings rows do not contain the expected ${expectedMatches} completed matches.`);
    }
  }
  if (leagueByWrestler.size !== 48) errors.push(`Active schedule contains ${leagueByWrestler.size} unique wrestlers; expected 48.`);
  return [...new Set(errors)];
}

export function createDashboardContextCandidate(input: {
  leagueYear: number;
  split: SplitName;
  completedThroughYearWeek: number;
  schedule: Match[];
  standings: StandingRow[];
}): WorkflowContextCandidate {
  const activeYearWeek = input.completedThroughYearWeek + 1;
  const contextSchedule = scheduleIdentity(input.schedule.filter((match) => (
    match.leagueYear === input.leagueYear && match.split === input.split
  )));
  const conflicts = validateStandingsComposition(
    input.standings,
    contextSchedule,
    input.leagueYear,
    input.split,
    input.completedThroughYearWeek,
  )
    .map((message) => conflict(
      "WORKBOOK_DASHBOARD_COMPOSITION_MISMATCH",
      message,
      ["workbook-dashboard"],
      "Review the current master workbook Dashboard, standings, and schedule together.",
      "warning",
    ));
  return {
    source: "workbook-dashboard",
    valid: true,
    leagueYear: input.leagueYear,
    split: input.split,
    activeYearWeek,
    completedThroughYearWeek: input.completedThroughYearWeek,
    splitWeek: splitWeek(input.split, activeYearWeek),
    phase: phaseFor(input.completedThroughYearWeek, activeYearWeek, input.split),
    scheduleSource: "Workbook Dashboard + Schedule_22W",
    standingsSource: "Standings_Current",
    resultsSource: "Schedule_22W",
    finalsReadiness: splitWeek(input.split, input.completedThroughYearWeek) >= 22 ? "ready" : "not-ready",
    sourceSignature: createWorkflowSourceSignature([
      "workbook-dashboard",
      input.leagueYear,
      input.split,
      input.completedThroughYearWeek,
      scheduleSignature(contextSchedule),
      standingsSignature(input.standings),
    ]),
    confidence: "low",
    conflicts,
  };
}

export function createAppWorkbookContextCandidate(input: AppWorkbookContextInput): WorkflowContextCandidate | null {
  if (!input.latestWriteback) return null;
  const { week, completedAt } = input.latestWriteback;
  const identity = scheduleIdentity(input.schedule);
  const context = scheduleContext(identity, week);
  const conflicts: WorkflowContextConflict[] = [];
  if (!context) {
    conflicts.push(conflict(
      "APP_CHECKPOINT_SCHEDULE_MISMATCH",
      `The latest chronological App writeback at Week ${week} does not have exactly 24 matches in one Year/Split context.`,
      ["app-workbook"],
      "Recreate the App checkpoint from one authoritative schedule.",
    ));
  } else {
    const activeSchedule = identity.filter((match) => match.leagueYear === context.leagueYear && match.split === context.split);
    const startWeek = splitStart(context.split);
    const weekCounts = Array.from({ length: 22 }, (_, index) => (
      activeSchedule.filter((match) => match.week === startWeek + index).length
    ));
    if (activeSchedule.length !== 528 || weekCounts.some((count) => count !== 24)) {
      conflicts.push(conflict(
        "APP_CHECKPOINT_SCHEDULE_INCOMPLETE",
        `The App checkpoint schedule has ${activeSchedule.length} active-context matches and must contain 24 matches in each of 22 regular weeks.`,
        ["app-workbook"],
        "Regenerate or promote one complete accepted schedule snapshot.",
      ));
    }
  }
  const resultWeeks = new Set(input.results.map((result) => result.week));
  if (input.results.length !== 24 || resultWeeks.size !== 1 || !resultWeeks.has(week)) {
    conflicts.push(conflict(
      "APP_CHECKPOINT_RESULTS_MISMATCH",
      `App_Confirmed_Results does not contain exactly the latest checkpoint's 24 Week ${week} results.`,
      ["app-workbook"],
      "Promote a coherent weekly close package before using this checkpoint.",
    ));
  }
  const scheduleById = new Map(identity.map((match) => [match.id, match]));
  const uniqueResultIds = new Set(input.results.map((result) => result.matchId));
  if (
    uniqueResultIds.size !== input.results.length
    || input.results.some((result) => {
      const match = scheduleById.get(result.matchId);
      return !match || !resultMatchesSchedule(result, match);
    })
  ) {
    conflicts.push(conflict(
      "APP_CHECKPOINT_RESULT_IDENTITY_MISMATCH",
      "App_Confirmed_Results contains duplicate or schedule-incompatible matchup identities.",
      ["app-workbook"],
      "Regenerate the App result sheet from the same accepted schedule checkpoint.",
    ));
  }
  if (!input.standings) {
    conflicts.push(conflict(
      "APP_CHECKPOINT_STANDINGS_INVALID",
      "App_State_Standings failed structural validation.",
      ["app-workbook"],
      "Regenerate the App standings snapshot from the matching schedule and results.",
    ));
  } else if (context) {
    for (const message of validateStandingsComposition(
      input.standings,
      identity,
      context.leagueYear,
      context.split,
      week,
    )) {
      conflicts.push(conflict(
        "APP_CHECKPOINT_STANDINGS_CONTEXT_MISMATCH",
        message,
        ["app-workbook"],
        "Regenerate App_State_Standings from the accepted schedule composition.",
      ));
    }
  }
  const leagueYear = context?.leagueYear ?? 1;
  const split = context?.split ?? "Opening Split";
  const activeYearWeek = week + 1;
  return {
    source: "app-workbook",
    valid: conflicts.every((entry) => entry.severity !== "error"),
    leagueYear,
    split,
    activeYearWeek,
    completedThroughYearWeek: week,
    splitWeek: splitWeek(split, activeYearWeek),
    phase: phaseFor(week, activeYearWeek, split),
    scheduleSource: "App_Accepted_Schedule / authoritative workbook schedule",
    standingsSource: "App_State_Standings",
    resultsSource: "App_Confirmed_Results",
    finalsReadiness: input.standings && splitWeek(split, week) >= 22 ? "ready" : input.standings ? "not-ready" : "invalid",
    sourceSignature: createWorkflowSourceSignature([
      "app-workbook",
      leagueYear,
      split,
      week,
      completedAt,
      scheduleSignature(identity.filter((match) => match.leagueYear === leagueYear && match.split === split)),
      input.standings ? standingsSignature(input.standings) : "invalid-standings",
      resultsSignature(input.results),
    ]),
    confidence: conflicts.length ? "conflicted" : "high",
    conflicts,
  };
}

function resultMatchesSchedule(result: ConfirmedResult, match: WorkflowScheduleIdentity): boolean {
  return result.week === match.week
    && result.league === match.league
    && result.wrestlerA === match.wrestlerA
    && result.wrestlerB === match.wrestlerB
    && (result.resultType !== "Winner" || result.winner === match.wrestlerA || result.winner === match.wrestlerB)
    && (result.resultType === "Winner" || result.winner === null);
}

function createLocalContextCandidate(state: TrackerState, baseline: WorkflowContextBaseline): WorkflowContextCandidate | null {
  const hasLocalEvidence = Boolean(state.activeWorkflow)
    || state.confirmedResults.length > 0
    || state.completedWeeks.length > 0;
  if (!hasLocalEvidence) return null;

  const selectedBaseline = baseline.selected === "app-workbook" && baseline.appWorkbook?.valid
    ? baseline.appWorkbook
    : baseline.dashboard;
  const workflow = state.activeWorkflow;
  const accepted = state.acceptedSchedule;
  const leagueYear = workflow?.leagueYear ?? selectedBaseline.leagueYear;
  const split = workflow?.split ?? selectedBaseline.split;
  const schedule = workflow && accepted
    ? accepted.matches.map((match) => ({
      id: match.id,
      leagueYear: match.leagueYear,
      split: match.split,
      week: match.yearWeek ?? match.splitWeek + (match.split === "Closing Split" ? 24 : 0),
      league: match.league,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
    }))
    : baseline.schedule.filter((match) => match.leagueYear === leagueYear && match.split === split);
  const conflicts: WorkflowContextConflict[] = [];
  const addError = (code: string, message: string, recommendedAction: string) => conflicts.push(
    conflict(code, message, ["local", selectedBaseline.source], recommendedAction),
  );

  if (workflow) {
    if (!accepted?.validation.valid || accepted.validation.totalMatches !== 528) {
      addError("LOCAL_SCHEDULE_INVALID", "Local activeWorkflow has no valid accepted 528-match schedule.", "Restore a valid tracker backup or discard the local workflow.");
    } else {
      if (accepted.leagueYear !== workflow.leagueYear || accepted.split !== workflow.split || accepted.acceptedAt !== workflow.acceptedScheduleAt) {
        addError("LOCAL_SCHEDULE_CONTEXT_MISMATCH", "Local activeWorkflow identity does not match its accepted schedule.", "Restore a tracker backup whose workflow and schedule were created together.");
      }
      if (schedule.length !== 528 || schedule.some((match) => match.leagueYear !== leagueYear || match.split !== split)) {
        addError("LOCAL_SCHEDULE_MIXED_CONTEXT", "The accepted local schedule mixes Year or Split contexts.", "Discard the contaminated local schedule and reactivate one validated snapshot.");
      }
    }
  }
  const checkpoint = state.workflowContextCheckpoint;
  const currentAcceptedScheduleSignature = acceptedScheduleSignature(state);
  if (
    !checkpoint
    || checkpoint.scope !== "user-workflow"
    || !checkpoint.baselineSourceSignature
    || !Number.isFinite(Date.parse(checkpoint.signedAt))
  ) {
    addError(
      "LOCAL_CONTEXT_UNSIGNED",
      "Browser-local workflow state has no valid context authority checkpoint and may be a legacy QA/session artifact.",
      "Import a validated backup or start a new workflow from the current authority.",
    );
  } else {
    if (checkpoint.acceptedScheduleSignature !== currentAcceptedScheduleSignature) {
      addError(
        "LOCAL_CONTEXT_SIGNATURE_MISMATCH",
        "Browser-local workflow metadata does not match its accepted schedule signature.",
        "Restore the backup that contains the matching workflow and accepted schedule.",
      );
    }
    if (!workflow && checkpoint.baselineSourceSignature !== selectedBaseline.sourceSignature) {
      addError(
        "LOCAL_BASELINE_SIGNATURE_MISMATCH",
        "Browser-local results were created from a different workbook context signature.",
        "Discard the incompatible local overlay or restore its matching workbook checkpoint.",
      );
    }
  }

  const scheduleById = new Map(schedule.map((match) => [match.id, match]));
  const startWeek = splitStart(split);
  const endWeek = startWeek + 21;
  const relevantLocks = state.completedWeeks
    .map((entry) => entry.week)
    .filter((week) => week >= startWeek && week <= endWeek)
    .sort((a, b) => a - b);
  if (new Set(relevantLocks).size !== relevantLocks.length) {
    addError("LOCAL_DUPLICATE_LOCK", "Local completed week locks contain duplicates.", "Restore or reset the invalid local tracker state.");
  }
  const expectedFirstLock = workflow ? startWeek : selectedBaseline.completedThroughYearWeek + 1;
  relevantLocks.forEach((week, index) => {
    if (week !== expectedFirstLock + index) {
      addError("LOCAL_WEEK_LOCK_GAP", "Local completed week locks are not contiguous from the selected baseline.", "Restore the last coherent tracker backup before continuing.");
    }
  });

  const resultIds = new Set<string>();
  for (const result of state.confirmedResults) {
    const match = scheduleById.get(result.matchId);
    if (!match || !resultMatchesSchedule(result, match)) {
      addError("LOCAL_RESULT_CONTEXT_MISMATCH", `${result.matchId} does not match the active context schedule.`, "Restore or remove the incompatible local tracker state.");
      continue;
    }
    if (resultIds.has(result.matchId)) addError("LOCAL_DUPLICATE_RESULT", `${result.matchId} has duplicate local results.`, "Restore or reset the invalid local tracker state.");
    resultIds.add(result.matchId);
  }
  for (const week of relevantLocks) {
    const weekMatches = schedule.filter((match) => match.week === week);
    const confirmed = weekMatches.filter((match) => resultIds.has(match.id));
    if (weekMatches.length !== 24 || confirmed.length !== 24) {
      addError("LOCAL_LOCK_RESULTS_INCOMPLETE", `Locked Week ${week} is not backed by 24 matching local results.`, "Restore a backup with complete locked-week results.");
    }
  }

  const completedThroughYearWeek = relevantLocks.at(-1) ?? (workflow ? startWeek - 1 : selectedBaseline.completedThroughYearWeek);
  const expectedActiveWeek = Math.min(endWeek + 1, completedThroughYearWeek + 1);
  const activeYearWeek = workflow?.yearWeek ?? expectedActiveWeek;
  const localProgress = leagueYear * 48 + completedThroughYearWeek;
  const baselineProgress = selectedBaseline.leagueYear * 48 + selectedBaseline.completedThroughYearWeek;
  if (localProgress < baselineProgress) {
    addError(
      "LOCAL_STATE_STALE",
      `Local workflow progress (${leagueYear}/${split}/Week ${completedThroughYearWeek}) predates the selected workbook checkpoint.`,
      "Discard the stale local workflow or restore a backup created after the workbook checkpoint.",
    );
  }
  if (workflow) {
    const expectedSplitWeek = splitWeek(split, activeYearWeek);
    if (workflow.splitWeek !== expectedSplitWeek || activeYearWeek !== expectedActiveWeek) {
      addError("LOCAL_ACTIVE_WEEK_MISMATCH", `Local active week ${activeYearWeek} does not follow completed Week ${completedThroughYearWeek}.`, "Restore the last coherent workflow checkpoint.");
    }
  }
  if (state.confirmedResults.some((result) => result.week > activeYearWeek)) {
    addError("LOCAL_FUTURE_RESULT", "Local results exist beyond the active workflow week.", "Restore or reset the invalid local tracker state.");
  }

  const unscopedFinalsState = workflow ? Boolean(
    (state.completedFinalsNights?.length || state.leagueFinalsResults?.length)
    && state.postFinalsTransitionCompleted?.nextLeagueYear === workflow.leagueYear
    && state.postFinalsTransitionCompleted?.nextSplit === workflow.split,
  ) : false;
  if (unscopedFinalsState) {
    conflicts.push(conflict(
      "LOCAL_PRIOR_FINALS_STATE_IGNORED",
      "Finals records from the preceding split are present but are not part of the active workflow context.",
      ["local"],
      "No action is required; the prior Finals state is excluded from current context readiness.",
      "warning",
    ));
  }

  const activeSplitWeek = splitWeek(split, activeYearWeek);
  const phase = phaseFor(completedThroughYearWeek, activeYearWeek, split);
  const blocking = conflicts.some((entry) => entry.severity === "error");
  return {
    source: "local",
    valid: !blocking,
    leagueYear,
    split,
    activeYearWeek,
    completedThroughYearWeek,
    splitWeek: activeSplitWeek,
    phase,
    scheduleSource: workflow?.scheduleSource ?? selectedBaseline.scheduleSource,
    standingsSource: "Validated baseline + browser-local results",
    resultsSource: "Validated browser-local tracker state",
    finalsReadiness: phase === "finals" || phase === "split-complete"
      ? (unscopedFinalsState ? "stale" : "ready")
      : "not-ready",
    sourceSignature: createWorkflowSourceSignature([
      "local",
      leagueYear,
      split,
      activeYearWeek,
      completedThroughYearWeek,
      scheduleSignature(schedule),
      resultsSignature(state.confirmedResults),
      relevantLocks.join(","),
      checkpoint?.baselineSourceSignature,
      checkpoint?.acceptedScheduleSignature,
    ]),
    confidence: blocking ? "conflicted" : conflicts.length ? "medium" : "high",
    conflicts,
  };
}

function selectedWorkbookCandidate(baseline: WorkflowContextBaseline): WorkflowContextCandidate {
  return baseline.selected === "app-workbook" && baseline.appWorkbook?.valid
    ? baseline.appWorkbook
    : baseline.dashboard;
}

function rejectedLocalDiagnostic(
  entry: WorkflowContextConflict,
  selected: WorkflowContextCandidate,
): WorkflowContextConflict {
  if (entry.code === "LOCAL_CONTEXT_UNSIGNED") {
    return conflict(
      entry.code,
      `Old browser session state was ignored. The app is using the validated ${selected.split.replace(" Split", "")} checkpoint.`,
      ["local"],
      "No action is required.",
      "warning",
    );
  }
  return {
    ...entry,
    severity: "warning",
    sources: ["local"],
    recommendedAction: "No action is required. The rejected browser state is excluded from the active workflow.",
  };
}

function rejectedWorkbookDiagnostic(entry: WorkflowContextConflict): WorkflowContextConflict {
  return {
    ...entry,
    severity: "warning",
    sources: ["app-workbook"],
  };
}

export function resolveWorkflowContextAuthority(
  baseline: WorkflowContextBaseline,
  state: TrackerState,
  hydrated: boolean,
): WorkflowContextAuthority {
  const workbookCandidate = selectedWorkbookCandidate(baseline);
  const local = hydrated ? createLocalContextCandidate(state, baseline) : null;
  const selected = local?.valid ? local : workbookCandidate;
  const selectedConflicts = selected.source === "local"
    ? local?.conflicts ?? []
    : workbookCandidate.conflicts;
  const rejectedLocalConflicts = local && !local.valid
    ? local.conflicts.map((entry) => rejectedLocalDiagnostic(entry, selected))
    : [];
  const rejectedWorkbookConflicts = workbookCandidate.source === "workbook-dashboard"
    ? baseline.conflicts.map(rejectedWorkbookDiagnostic)
    : [];
  const supportingWorkbookNotices = selected.source === "local"
    ? workbookCandidate.conflicts.filter((entry) => entry.severity === "warning")
    : [];
  const blockingConflicts = selectedConflicts.filter((entry) => (
    entry.severity === "error" && entry.sources.includes(selected.source)
  ));
  const diagnosticNotices = [
    ...selectedConflicts.filter((entry) => !blockingConflicts.includes(entry)),
    ...supportingWorkbookNotices,
    ...rejectedLocalConflicts,
    ...rejectedWorkbookConflicts,
  ];
  const uniqueBlockingConflicts = [...new Map(
    blockingConflicts.map((entry) => [`${entry.code}:${entry.message}`, entry]),
  ).values()];
  const uniqueDiagnosticNotices = [...new Map(
    diagnosticNotices.map((entry) => [`${entry.code}:${entry.message}`, entry]),
  ).values()];
  const conflicts = [...uniqueBlockingConflicts, ...uniqueDiagnosticNotices];
  const rejectedSources = [
    ...(local && !local.valid ? ["local" as const] : []),
    ...(workbookCandidate.source === "workbook-dashboard" && baseline.appWorkbook
      ? ["app-workbook" as const]
      : []),
  ];
  return {
    ...selected,
    activeSource: selected.source,
    localStateAccepted: selected.source === "local",
    confidence: uniqueBlockingConflicts.length > 0 ? "conflicted" : selected.confidence,
    blockingConflicts: uniqueBlockingConflicts,
    diagnosticNotices: uniqueDiagnosticNotices,
    rejectedSources: [...new Set(rejectedSources)],
    conflicts: conflicts.sort((a, b) => (
      SOURCE_PRIORITY[b.sources[0]] - SOURCE_PRIORITY[a.sources[0]]
      || a.code.localeCompare(b.code)
    )),
  };
}

export function buildWorkflowContextBaseline(input: {
  dashboard: WorkflowContextCandidate;
  appWorkbook: WorkflowContextCandidate | null;
  dashboardSchedule: Match[];
}): WorkflowContextBaseline {
  const appConflicts = input.appWorkbook?.conflicts ?? [];
  const appSelected = Boolean(input.appWorkbook?.valid);
  const selectedCandidate = appSelected ? input.appWorkbook! : input.dashboard;
  const schedule = scheduleIdentity(input.dashboardSchedule.filter((match) => (
    match.leagueYear === selectedCandidate.leagueYear && match.split === selectedCandidate.split
  )));
  return {
    dashboard: input.dashboard,
    appWorkbook: input.appWorkbook,
    selected: appSelected ? "app-workbook" : "workbook-dashboard",
    schedule,
    conflicts: appConflicts,
  };
}
