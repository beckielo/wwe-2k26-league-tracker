import { calculatePoints } from "./scoring";
import type { LeagueName, Match, MatchResult, SplitName, StandingRow } from "./types";
import type { NewRunSetupDraft } from "./new-run-setup";
import type { FinalsNight, LeagueFinalsResult } from "./league-finals";
import type { AcceptedScheduleSnapshot } from "./schedule-setup";
import type { PostFinalsAssignment } from "./post-finals-transition";
import { applyRosterReplacementsToMatches, applyRosterReplacementsToStandings, type RosterReplacementLogEntry } from "./roster-replacement";
import type { LastCompletedSplitChampionMetadata } from "./previous-split-name-colors";

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

export type ManualReviewStatus = "open" | "resolved" | "cleared";
export type ManualReviewScope = "regular" | "league-finals";

export interface ManualReview {
  id: string;
  scope: ManualReviewScope;
  matchId: string;
  league: LeagueName;
  weekOrEvent: string;
  wrestlerA: string;
  wrestlerB: string;
  note: string;
  status: ManualReviewStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TrackerState {
  version: 1;
  confirmedResults: ConfirmedResult[];
  completedWeeks: CompletedWeek[];
  workflowContextCheckpoint?: LocalWorkflowContextCheckpoint;
  lastExportedAt: string | null;
  lastImportedAt: string | null;
  leagueFinalsResults?: LeagueFinalsResult[];
  completedFinalsNights?: { night: FinalsNight; completedAt: string }[];
  acceptedSchedule?: AcceptedScheduleSnapshot;
  acceptedPostFinalsComposition?: AcceptedPostFinalsCompositionSnapshot;
  postFinalsTransitionCompleted?: PostFinalsTransitionCompletion;
  activeWorkflow?: ActiveWorkflow;
  manualReviews?: ManualReview[];
  currentUserWrestler?: string;
  rosterReplacements?: RosterReplacementLogEntry[];
  newRunSetupDraft?: NewRunSetupDraft;
  completedSplitLegacyCommits?: CompletedSplitLegacyCommit[];
  lastCompletedAchievementMetadata?: LastCompletedSplitChampionMetadata | null;
  championMetadataAudit?: import("./previous-split-name-colors").ChampionMetadataAudit;
}

export interface LocalWorkflowContextCheckpoint {
  scope: "user-workflow";
  baselineSourceSignature: string;
  acceptedScheduleSignature: string | null;
  signedAt: string;
}

export interface CompletedSplitLegacyCommit {
  sourceSignature: string;
  committedAt: string;
  leagueYear: number;
  split: SplitName;
  titleRecords: { league: string; wrestler: string }[];
  eliteCupWinner: string | null;
  eliteCupRunnerUp?: string | null;
  directPromotions?: { wrestler: string; from: LeagueName; to: LeagueName }[];
  directRelegations?: { wrestler: string; from: LeagueName; to: LeagueName }[];
  relegationPlayoffWinners?: { wrestler: string; matchId?: string }[];
  relegationPlayoffLosers?: { wrestler: string; matchId?: string }[];
}

export interface AcceptedPostFinalsCompositionSnapshot {
  postFinalsCompositionAccepted: true;
  leagueYear: number;
  split: SplitName;
  nextLeagueYear: number;
  nextSplit: SplitName;
  sourceSignature: string;
  rosters: Record<LeagueName, PostFinalsAssignment[]>;
  movementSummary: {
    directMovements: PostFinalsAssignment[];
    playoffMovements: PostFinalsAssignment[];
  };
  acceptedAt: string;
}

export interface PostFinalsTransitionCompletion {
  completedAt: string;
  sourceSignature: string;
  leagueYear: number;
  split: SplitName;
  nextLeagueYear: number;
  nextSplit: SplitName;
  acceptedScheduleAt: string;
}

export interface ActiveWorkflow {
  leagueYear: number;
  split: SplitName;
  yearWeek: number;
  splitWeek: number;
  scheduleSource: "accepted generated snapshot" | "accepted imported snapshot";
  acceptedScheduleAt: string;
  activatedAt: string;
  userLeague: LeagueName;
}

export interface StateActionResult {
  ok: boolean;
  state: TrackerState;
  errors: string[];
}

export const TRACKER_STATE_STORAGE_KEY = "wwe-2k26-tracker-state-v1";

export function createEmptyTrackerState(): TrackerState {
  return {
    version: 1,
    confirmedResults: [],
    completedWeeks: [],
    lastExportedAt: null,
    lastImportedAt: null,
    leagueFinalsResults: [],
    completedFinalsNights: [],
    manualReviews: [],
  };
}

export function openManualReviews(state: TrackerState, scope?: ManualReviewScope): ManualReview[] {
  return (state.manualReviews ?? []).filter((review) => review.status === "open" && (!scope || review.scope === scope));
}

export function markManualReview(state: TrackerState, review: Omit<ManualReview, "id" | "status" | "createdAt" | "resolvedAt">, createdAt = new Date().toISOString()): StateActionResult {
  if (!review.note.trim()) return { ok: false, state, errors: ["Manual Review requires a note/reason."] };
  if ((state.manualReviews ?? []).some((entry) => entry.matchId === review.matchId && entry.status === "open")) {
    return { ok: false, state, errors: [`${review.matchId}: an open Manual Review already exists.`] };
  }
  const entry: ManualReview = { ...review, id: `review-${review.scope}-${review.matchId}-${createdAt}`, note: review.note.trim(), status: "open", createdAt, resolvedAt: null };
  return { ok: true, errors: [], state: { ...state, manualReviews: [...(state.manualReviews ?? []), entry] } };
}

export function closeManualReview(state: TrackerState, reviewId: string, status: "resolved" | "cleared", resolvedAt = new Date().toISOString()): StateActionResult {
  const review = (state.manualReviews ?? []).find((entry) => entry.id === reviewId);
  if (!review) return { ok: false, state, errors: [`${reviewId}: Manual Review not found.`] };
  if (review.status !== "open") return { ok: false, state, errors: [`${reviewId}: Manual Review is already ${review.status}.`] };
  return { ok: true, errors: [], state: { ...state, manualReviews: (state.manualReviews ?? []).map((entry) => entry.id === reviewId ? { ...entry, status, resolvedAt } : entry) } };
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
for (const review of openManualReviews(state, "regular").filter((entry) => entry.weekOrEvent === `Week ${week}`)) {
errors.push(`${review.matchId}: open Manual Review must be resolved or cleared before Week ${week} can be locked.`);
}
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

export function recoverPostRegularSeasonWorkflowState(state: TrackerState): TrackerState {
  const workflow = state.activeWorkflow;
  if (!workflow || workflow.split !== "Closing Split") return state;
  const week22Complete = isWeekLocked(state, 46);
  const stuckOnFinalRegularCard = workflow.yearWeek === 46 && workflow.splitWeek === 22;
  if (!week22Complete || !stuckOnFinalRegularCard) return state;
  return {
    ...state,
    activeWorkflow: {
      ...workflow,
      yearWeek: 47,
      splitWeek: 23,
    },
  };
}

export function advanceActiveWorkflowAfterLock(state: TrackerState, lockedWeek: number): TrackerState {
  if (!state.activeWorkflow || state.activeWorkflow.split !== "Closing Split") return state;
  const nextYearWeek = lockedWeek >= 46 ? 47 : lockedWeek + 1;
  if (lockedWeek < state.activeWorkflow.yearWeek || nextYearWeek === state.activeWorkflow.yearWeek) return recoverPostRegularSeasonWorkflowState(state);
  return recoverPostRegularSeasonWorkflowState({
    ...state,
    activeWorkflow: {
      ...state.activeWorkflow,
      yearWeek: nextYearWeek,
      splitWeek: Math.max(1, nextYearWeek - 24),
    },
  });
}

export function getLatestLockedWeek(state: TrackerState): CompletedWeek | null {
  return [...state.completedWeeks].sort((a, b) => b.week - a.week)[0] ?? null;
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
  const lockedState = { ...state, completedWeeks: [...state.completedWeeks, { week, completedAt }] };
  return { ok: true, errors: [], state: advanceActiveWorkflowAfterLock(lockedState, week) };
}

export function unlockWeek(state: TrackerState, week: number): TrackerState {
  return { ...state, completedWeeks: state.completedWeeks.filter((entry) => entry.week !== week) };
}

function resetRowsForSplit(rows: StandingRow[], split: SplitName): StandingRow[] {
  if (split !== "Closing Split") return rows;
  return rows.map((row) => ({
    ...row,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: row.status ? `${row.status} · active split reset` : "active split reset",
  }));
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function resultIdentity(league: LeagueName, week: number, wrestlerA: string, wrestlerB: string): string {
  return `${league}:${week}:${[normalized(wrestlerA), normalized(wrestlerB)].sort().join("::")}`;
}

function matchIdentity(match: Match): string {
  return resultIdentity(match.league, match.week, match.wrestlerA, match.wrestlerB);
}

function findScheduledMatchForResult(result: ConfirmedResult, matchesById: Map<string, Match>, matchesByIdentity: Map<string, Match>): Match | null {
  return matchesById.get(result.matchId)
    ?? matchesByIdentity.get(resultIdentity(result.league, result.week, result.wrestlerA, result.wrestlerB))
    ?? null;
}

function standingsFromPostFinalsAssignments(assignments: PostFinalsAssignment[], sourceStandings: StandingRow[]): StandingRow[] {
  const sourceByName = new Map(sourceStandings.map((row) => [normalized(row.wrestler), row]));
  return assignments.map((assignment): StandingRow => {
    const source = sourceByName.get(normalized(assignment.wrestler));
    return {
      league: assignment.newLeague,
      rank: 99,
      wrestler: assignment.wrestler,
      seed: source?.seed ?? assignment.priorRank,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      status: `${assignment.movement}${assignment.finalsOutcome ? ` · ${assignment.finalsOutcome}` : ""}`,
    };
  });
}

function standingsFromScheduleComposition(sourceStandings: StandingRow[], scheduledMatches: Match[]): StandingRow[] | null {
  const byLeague = new Map<LeagueName, string[]>();
  for (const league of ["Global League", "Continental League", "National League", "Regional League"] as LeagueName[]) byLeague.set(league, []);
  for (const match of scheduledMatches) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const rows = byLeague.get(match.league)!;
      if (!rows.some((name) => normalized(name) === normalized(wrestler))) rows.push(wrestler);
    }
  }
  if ([...byLeague.values()].some((rows) => rows.length !== 12)) return null;
  const all = [...byLeague.values()].flat();
  if (new Set(all.map(normalized)).size !== 48) return null;
  const sourceByName = new Map(sourceStandings.map((row) => [normalized(row.wrestler), row]));
  return (["Global League", "Continental League", "National League", "Regional League"] as LeagueName[]).flatMap((league) =>
    byLeague.get(league)!.map((wrestler, index): StandingRow => ({
      league,
      rank: index + 1,
      wrestler,
      seed: sourceByName.get(normalized(wrestler))?.seed ?? index + 1,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      status: "post-finals schedule composition",
    })),
  );
}

function validateRoster(rows: StandingRow[]): string[] {
  const diagnostics: string[] = [];
  const leagueCounts = new Map<LeagueName, number>();
  const seen = new Map<string, LeagueName>();
  for (const row of rows) {
    leagueCounts.set(row.league, (leagueCounts.get(row.league) ?? 0) + 1);
    const existing = seen.get(normalized(row.wrestler));
    if (existing && existing !== row.league) diagnostics.push(`Current roster has duplicate wrestler: ${row.wrestler} appears in ${existing} and ${row.league}.`);
    seen.set(normalized(row.wrestler), row.league);
  }
  for (const league of ["Global League", "Continental League", "National League", "Regional League"] as LeagueName[]) {
    const count = leagueCounts.get(league) ?? 0;
    if (count !== 12) diagnostics.push(`${league} current roster has ${count} wrestlers; expected 12.`);
  }
  return diagnostics;
}

export interface ActiveSplitLiveStandingsInput {
  previousFinalStandings: StandingRow[];
  postFinalsAssignments?: PostFinalsAssignment[];
  scheduledMatches: Match[];
  masterResults: MatchResult[];
  localResults: ConfirmedResult[];
  split: SplitName;
  completedThroughWeek: number;
  activeLeagueYear?: number;
  rosterReplacements?: RosterReplacementLogEntry[];
  newRunSetupDraft?: NewRunSetupDraft;
}

export interface ActiveSplitLiveStandings {
  composition: StandingRow[];
  standings: StandingRow[];
  diagnostics: string[];
}

export function reconstructActiveSplitLiveStandings(input: ActiveSplitLiveStandingsInput): ActiveSplitLiveStandings {
  const startWeek = splitStartWeek(input.split);
  const latestLocalWeek = Math.max(input.completedThroughWeek, ...input.localResults.map((result) => result.week));
  const activeLeagueYear = input.activeLeagueYear ?? 2;
  const activeMatches = input.scheduledMatches.filter((match) => match.leagueYear === activeLeagueYear && match.split === input.split && match.week >= startWeek && match.week <= latestLocalWeek);
  const allSplitMatches = applyRosterReplacementsToMatches(input.scheduledMatches.filter((match) => match.leagueYear === activeLeagueYear && match.split === input.split), input.rosterReplacements ?? [], new Set(input.localResults.map((result) => result.matchId)));
  const diagnostics: string[] = [];
  if (allSplitMatches.length === 0 && input.masterResults.length === 0 && input.localResults.length === 0) {
    return { composition: input.previousFinalStandings, standings: input.previousFinalStandings, diagnostics: [] };
  }
  let composition = input.postFinalsAssignments?.length
    ? standingsFromPostFinalsAssignments(input.postFinalsAssignments, input.previousFinalStandings)
    : standingsFromScheduleComposition(input.previousFinalStandings, allSplitMatches);
  if (!composition) {
    diagnostics.push("Missing post-finals transition source.");
    composition = resetRowsForSplit(input.previousFinalStandings, input.split);
  }
  composition = applyRosterReplacementsToStandings(composition, input.rosterReplacements ?? []).map((row) => ({ ...row, matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }));
  diagnostics.push(...validateRoster(composition));

  const leagueByRoster = new Map(composition.map((row) => [normalized(row.wrestler), row.league]));
  for (const match of allSplitMatches) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const rosterLeague = leagueByRoster.get(normalized(wrestler));
      if (rosterLeague && rosterLeague !== match.league) diagnostics.push(`Accepted schedule places ${wrestler} in ${match.league} but standings roster places him in ${rosterLeague}.`);
    }
  }

  const matchesById = new Map(activeMatches.map((match) => [match.id, match]));
  const matchesByIdentity = new Map(activeMatches.map((match) => [matchIdentity(match), match]));
  const activeMatchIds = new Set(activeMatches.map((match) => match.id));
  const masterConfirmed = input.masterResults
    .map((result): ConfirmedResult | null => {
      const direct = matchesById.get(result.matchId);
      if (!direct || result.outcome === "unclear") return null;
      return resultFromMatchResult(result, direct);
    })
    .filter((result): result is ConfirmedResult => Boolean(result));
  const used = new Set<string>();
  const merged: ConfirmedResult[] = [];
  for (const result of masterConfirmed) {
    const match = findScheduledMatchForResult(result, matchesById, matchesByIdentity);
    if (!match) continue;
    used.add(match.id);
    merged.push({ ...result, matchId: match.id });
  }
  for (const result of input.localResults) {
    const match = findScheduledMatchForResult(result, matchesById, matchesByIdentity);
    if (!match || used.has(match.id)) continue;
    if (result.matchId !== match.id) diagnostics.push(`Result ID mismatch reconciled by participants/week/league: ${result.matchId} → ${match.id}.`);
    used.add(match.id);
    merged.push({ ...result, matchId: match.id, league: match.league, week: match.week, wrestlerA: match.wrestlerA, wrestlerB: match.wrestlerB });
  }
  const weeksWithResults = new Set(merged.map((result) => result.week));
  for (const week of activeSplitResultWeekRange(input.split, input.completedThroughWeek)) {
    if (!weeksWithResults.has(week)) diagnostics.push(`${input.split} Week ${splitWeekFromYearWeek(input.split, week)} results missing from local/master state.`);
  }
  if (weeksWithResults.size === 1 && splitWeekFromYearWeek(input.split, input.completedThroughWeek) > 1) {
    diagnostics.push(`Only 1 locked ${input.split} week found, but UI claims Week ${splitWeekFromYearWeek(input.split, input.completedThroughWeek)}.`);
  }
  const standings = calculateStandingsWithConfirmedResults(composition, activeMatches, merged.filter((result) => activeMatchIds.has(result.matchId)));
  return { composition, standings, diagnostics: [...new Set(diagnostics)] };
}


function splitStartWeek(split: SplitName): number {
  return split === "Closing Split" ? 25 : 1;
}

export function splitWeekFromYearWeek(split: SplitName, yearWeek: number): number {
  return split === "Closing Split" ? Math.max(1, yearWeek - 24) : yearWeek;
}

function resultFromMatchResult(result: MatchResult, match: Match): ConfirmedResult | null {
  if (result.outcome === "unclear") return null;
  return {
    league: match.league,
    week: match.week,
    matchId: result.matchId,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: result.outcome === "draw" ? "Draw" : result.outcome === "no-contest" ? "No Contest" : "Winner",
    winner: result.outcome === "decisive" ? result.winner : null,
    source: result.resultSource === "Manual" || result.resultSource === "User" ? "Manual" : "Simulation",
    confirmedAt: "current-master",
  };
}

export function activeSplitResultWeekRange(split: SplitName, completedThroughWeek: number): number[] {
  const start = splitStartWeek(split);
  const end = Math.max(start - 1, completedThroughWeek);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function validateActiveSplitStandings(standings: StandingRow[], splitWeek: number): string[] {
  const errors: string[] = [];
  const wrestlerLeagues = new Map<string, LeagueName>();
  const leagues = new Map<LeagueName, StandingRow[]>();
  for (const row of standings) {
    leagues.set(row.league, [...(leagues.get(row.league) ?? []), row]);
    const existing = wrestlerLeagues.get(row.wrestler.toLowerCase());
    if (existing && existing !== row.league) errors.push(`Duplicate wrestler across leagues: ${row.wrestler} appears in ${existing} and ${row.league}.`);
    wrestlerLeagues.set(row.wrestler.toLowerCase(), row.league);
    if (row.matches > splitWeek) errors.push(`Active split standings source is invalid: ${row.wrestler} has ${row.matches} matches in split week ${splitWeek}.`);
    if (row.points > splitWeek * 3) errors.push(`Active split standings source is invalid: ${row.wrestler} has ${row.points} points in split week ${splitWeek}.`);
    if (row.wins + row.draws + row.losses !== row.matches) errors.push(`Active split standings source is invalid: ${row.wrestler} has wins + draws + losses that do not equal matches played.`);
    if (row.points !== calculatePoints(row.wins, row.draws)) errors.push(`Active split standings source is invalid: ${row.wrestler} has points that do not equal wins × 3 + draws.`);
  }
  for (const [league, rows] of leagues) if (rows.length !== 12) errors.push(`Active split standings source is invalid: ${league} has ${rows.length} wrestlers; expected 12.`);
  return [...new Set(errors)];
}

export function calculateLiveStandingsFromCurrentMaster(
  currentMasterStandings: StandingRow[],
  scheduledMatches: Match[],
  confirmedResults: ConfirmedResult[],
  split: SplitName,
  currentMasterCompletedThroughWeek: number,
  currentMasterResults: MatchResult[] = [],
): StandingRow[] {
  const splitMatches = scheduledMatches.filter((match) => match.leagueYear === 2 && match.split === split);
  if (currentMasterResults.length === 0 && standingsFromScheduleComposition(currentMasterStandings, splitMatches) === null) {
    const newerOverlayMatches = splitMatches.filter((match) => match.week > currentMasterCompletedThroughWeek);
    const newerOverlayMatchIds = new Set(newerOverlayMatches.map((match) => match.id));
    return calculateStandingsWithConfirmedResults(
      currentMasterStandings,
      newerOverlayMatches,
      confirmedResults.filter((result) => newerOverlayMatchIds.has(result.matchId)),
    );
  }
  return reconstructActiveSplitLiveStandings({
    previousFinalStandings: currentMasterStandings,
    scheduledMatches,
    masterResults: currentMasterResults,
    localResults: confirmedResults,
    split,
    completedThroughWeek: currentMasterCompletedThroughWeek,
    rosterReplacements: [],
  }).standings;
}

export function calculateActiveSplitStandingsWithConfirmedResults(
  baseline: StandingRow[],
  scheduledMatches: Match[],
  confirmedResults: ConfirmedResult[],
  split: SplitName,
): StandingRow[] {
  const splitMatches = scheduledMatches.filter((match) => match.leagueYear === 2 && match.split === split);
  const splitMatchIds = new Set(splitMatches.map((match) => match.id));
  return calculateStandingsWithConfirmedResults(
    resetRowsForSplit(baseline, split),
    splitMatches,
    confirmedResults.filter((result) => splitMatchIds.has(result.matchId)),
  );
}

export function calculateStandingsWithConfirmedResults(
  baseline: StandingRow[],
  scheduledMatches: Match[],
  confirmedResults: ConfirmedResult[],
): StandingRow[] {
  const rows = baseline.map((row) => ({ ...row }));
  const rowByKey = new Map(rows.map((row) => [`${row.league}:${normalized(row.wrestler)}`, row]));
  const matchById = new Map(scheduledMatches.map((match) => [match.id, match]));

  for (const result of confirmedResults) {
    const match = matchById.get(result.matchId);
    if (!match) continue;
    const rowA = rowByKey.get(`${match.league}:${normalized(match.wrestlerA)}`);
    const rowB = rowByKey.get(`${match.league}:${normalized(match.wrestlerB)}`);
    if (!rowA && !rowB) continue;
    if (rowA) rowA.matches += 1;
    if (rowB) rowB.matches += 1;
    if (result.resultType === "Draw" || result.resultType === "No Contest") {
      if (rowA) rowA.draws += 1;
      if (rowB) rowB.draws += 1;
    } else if (result.winner) {
      const winnerIsA = normalized(result.winner) === normalized(match.wrestlerA);
      const winner = winnerIsA ? rowA : rowB;
      const loser = winnerIsA ? rowB : rowA;
      if (winner) winner.wins += 1;
      if (loser) loser.losses += 1;
    }
    if (rowA) rowA.points = calculatePoints(rowA.wins, rowA.draws);
    if (rowB) rowB.points = calculatePoints(rowB.wins, rowB.draws);
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
