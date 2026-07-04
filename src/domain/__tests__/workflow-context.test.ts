import { describe, expect, it } from "vitest";
import {
  acceptedScheduleMatches,
  createAcceptedScheduleSnapshot,
  generateSchedule,
  validateSchedule,
  type ScheduleSeed,
} from "../schedule-setup";
import { createEmptyTrackerState, type ConfirmedResult, type TrackerState } from "../tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type SplitName, type StandingRow } from "../types";
import {
  buildWorkflowContextBaseline,
  createAppWorkbookContextCandidate,
  createDashboardContextCandidate,
  resolveWorkflowContextAuthority,
  signLocalWorkflowContext,
} from "../workflow-context";

const generatedAt = "2026-07-04T00:00:00.000Z";
const seeds = Object.fromEntries(LEAGUE_NAMES.map((league, leagueIndex) => [
  league,
  Array.from({ length: 12 }, (_, index) => ({
    seed: index + 1,
    wrestler: `Authority ${leagueIndex + 1}-${index + 1}`,
  })),
])) as Record<LeagueName, ScheduleSeed[]>;
const rosters = Object.fromEntries(LEAGUE_NAMES.map((league) => [
  league,
  seeds[league].map((entry) => entry.wrestler),
])) as Record<LeagueName, string[]>;

function acceptedSchedule(leagueYear: number, split: SplitName) {
  const preview = generateSchedule({
    leagueYear,
    split,
    yearWeekStart: split === "Closing Split" ? 25 : 1,
    generatedAt,
    seeds,
  });
  return createAcceptedScheduleSnapshot({
    preview,
    validation: validateSchedule(preview, { rosters }),
    acceptedAt: generatedAt,
    leagueYear,
    split,
  });
}

function standings(matches = 0): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => seeds[league].map((entry, index) => ({
    league,
    rank: index + 1,
    wrestler: entry.wrestler,
    seed: entry.seed,
    matches,
    wins: matches,
    draws: 0,
    losses: 0,
    points: matches * 3,
    status: "",
  })));
}

function confirmed(match: Match, confirmedAt = generatedAt): ConfirmedResult {
  return {
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: "Simulation",
    confirmedAt,
  };
}

const openingSchedule = acceptedScheduleMatches(acceptedSchedule(2, "Opening Split"));
const closingSnapshot = acceptedSchedule(2, "Closing Split");
const closingSchedule = acceptedScheduleMatches(closingSnapshot);
const week36Results = closingSchedule.filter((match) => match.week === 36).map((match) => confirmed(match));

function baseline(options: { validApp?: boolean; appWeek?: number } = {}) {
  const dashboard = createDashboardContextCandidate({
    leagueYear: 2,
    split: "Opening Split",
    completedThroughYearWeek: 13,
    schedule: openingSchedule,
    standings: standings(13),
  });
  const appWeek = options.appWeek ?? 36;
  const appResults = closingSchedule.filter((match) => match.week === appWeek).map((match) => confirmed(match));
  if (options.validApp === false) appResults.pop();
  const appWorkbook = createAppWorkbookContextCandidate({
    latestWriteback: { week: appWeek, completedAt: "2026-07-03T20:00:00.000Z" },
    schedule: [...openingSchedule, ...closingSchedule],
    standings: standings(appWeek - 24),
    results: appResults,
  });
  return buildWorkflowContextBaseline({
    dashboard,
    appWorkbook,
    dashboardSchedule: [...openingSchedule, ...closingSchedule],
  });
}

function activeLocalState(completedThroughWeek: number): TrackerState {
  const completedWeeks = Array.from(
    { length: Math.max(0, completedThroughWeek - 24) },
    (_, index) => ({ week: index + 25, completedAt: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z` }),
  );
  const confirmedResults = closingSchedule
    .filter((match) => match.week <= completedThroughWeek)
    .map((match) => confirmed(match));
  return signLocalWorkflowContext({
    ...createEmptyTrackerState(),
    acceptedSchedule: closingSnapshot,
    activeWorkflow: {
      leagueYear: 2,
      split: "Closing Split",
      yearWeek: completedThroughWeek + 1,
      splitWeek: completedThroughWeek - 23,
      scheduleSource: "accepted generated snapshot",
      acceptedScheduleAt: closingSnapshot.acceptedAt,
      activatedAt: generatedAt,
      userLeague: "National League",
    },
    confirmedResults,
    completedWeeks,
  }, "workflow-test-origin", generatedAt);
}

describe("workflow context authority", () => {
  it("selects the coherent App checkpoint when no valid local session exists", () => {
    const authority = resolveWorkflowContextAuthority(baseline(), createEmptyTrackerState(), true);
    expect(authority).toMatchObject({
      activeSource: "app-workbook",
      leagueYear: 2,
      split: "Closing Split",
      completedThroughYearWeek: 36,
      activeYearWeek: 37,
      confidence: "high",
      localStateAccepted: false,
    });
  });

  it("allows a coherent active local session to lead after the App checkpoint", () => {
    const authority = resolveWorkflowContextAuthority(baseline(), activeLocalState(37), true);
    expect(authority).toMatchObject({
      activeSource: "local",
      split: "Closing Split",
      completedThroughYearWeek: 37,
      activeYearWeek: 38,
      confidence: "high",
      localStateAccepted: true,
    });
  });

  it("rejects a stale local workflow and retains the newer App checkpoint", () => {
    const authority = resolveWorkflowContextAuthority(baseline(), activeLocalState(24), true);
    expect(authority.activeSource).toBe("app-workbook");
    expect(authority.completedThroughYearWeek).toBe(36);
    expect(authority.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "LOCAL_STATE_STALE", severity: "error" }),
    ]));
  });

  it("rejects an otherwise coherent unsigned local workflow as a legacy QA/session artifact", () => {
    const state = activeLocalState(37);
    state.workflowContextCheckpoint = undefined;
    const authority = resolveWorkflowContextAuthority(baseline(), state, true);
    expect(authority.activeSource).toBe("app-workbook");
    expect(authority.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "LOCAL_CONTEXT_UNSIGNED", severity: "error" }),
    ]));
  });

  it("rejects local results that do not match the accepted schedule identity", () => {
    const state = activeLocalState(37);
    state.confirmedResults[0] = { ...state.confirmedResults[0], wrestlerA: "Contaminated QA Wrestler" };
    const authority = resolveWorkflowContextAuthority(baseline(), state, true);
    expect(authority.activeSource).toBe("app-workbook");
    expect(authority.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "LOCAL_RESULT_CONTEXT_MISMATCH", severity: "error" }),
    ]));
  });

  it("uses Dashboard only when the App checkpoint is semantically incoherent", () => {
    const authority = resolveWorkflowContextAuthority(baseline({ validApp: false }), createEmptyTrackerState(), true);
    expect(authority).toMatchObject({
      activeSource: "workbook-dashboard",
      split: "Opening Split",
      completedThroughYearWeek: 13,
      confidence: "low",
    });
    expect(authority.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_CHECKPOINT_RESULTS_MISMATCH", severity: "error" }),
    ]));
  });

  it("falls back without changing context when browser-local state is lost", () => {
    const appAuthority = resolveWorkflowContextAuthority(baseline(), createEmptyTrackerState(), true);
    const dashboardAuthority = resolveWorkflowContextAuthority(
      buildWorkflowContextBaseline({
        dashboard: baseline({ validApp: false }).dashboard,
        appWorkbook: null,
        dashboardSchedule: openingSchedule,
      }),
      createEmptyTrackerState(),
      true,
    );
    expect(appAuthority.activeSource).toBe("app-workbook");
    expect(dashboardAuthority.activeSource).toBe("workbook-dashboard");
  });

  it("changes the source signature when result data changes", () => {
    const first = createAppWorkbookContextCandidate({
      latestWriteback: { week: 36, completedAt: "2026-07-03T20:00:00.000Z" },
      schedule: closingSchedule,
      standings: standings(12),
      results: week36Results,
    });
    const changedResults = week36Results.map((result, index) => index === 0
      ? { ...result, winner: result.wrestlerB }
      : result);
    const second = createAppWorkbookContextCandidate({
      latestWriteback: { week: 36, completedAt: "2026-07-03T20:00:00.000Z" },
      schedule: closingSchedule,
      standings: standings(12),
      results: changedResults,
    });
    expect(first?.valid).toBe(true);
    expect(second?.valid).toBe(true);
    expect(first?.sourceSignature).not.toBe(second?.sourceSignature);
  });

  it("does not expose a local context before hydration completes", () => {
    const authority = resolveWorkflowContextAuthority(baseline(), activeLocalState(37), false);
    expect(authority.activeSource).toBe("app-workbook");
    expect(authority.localStateAccepted).toBe(false);
  });
});
