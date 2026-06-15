import { describe, expect, it } from "vitest";
import { activateWeek25, generateSchedule, getActiveWorkflowMatches, getWeek25ActivationStatus, validateSchedule } from "../schedule-setup";
import { completeWeek, createEmptyTrackerState } from "../tracker-state";
import { LEAGUE_NAMES } from "../types";
import { createWeeklyCloseExports } from "../weekly-close-exports";
import { detectActiveWeek, getActiveUserLeagueMatches } from "../week-progression";

const seeds = Object.fromEntries(LEAGUE_NAMES.map((league) => [league, Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, wrestler: `${league} Wrestler ${index + 1}` }))])) as Parameters<typeof generateSchedule>[0]["seeds"];
const rosters = Object.fromEntries(LEAGUE_NAMES.map((league) => [league, seeds[league].map((entry) => entry.wrestler)])) as Record<(typeof LEAGUE_NAMES)[number], string[]>;
const matches = generateSchedule({ leagueYear: 2, split: "Closing Split", yearWeekStart: 25, seeds, generatedAt: "2026-06-14T00:00:00.000Z" });
const validation = validateSchedule(matches, { rosters });
const acceptedSchedule = { matches: matches.map((match) => ({ ...match, validationStatus: "Valid" as const })), acceptedAt: "2026-06-14T00:00:00.000Z", acceptedBy: "local user workflow" as const, source: "Generated" as const, leagueYear: 2, split: "Closing Split" as const, seedSource: "Phase 9.5", rosterSource: "Phase 9B", validation };

describe("Week 25 activation", () => {
  it("does not auto-start from acceptance and enables explicit activation only when ready", () => {
    const state = { ...createEmptyTrackerState(), acceptedSchedule };
    expect(state.activeWorkflow).toBeUndefined();
    expect(getWeek25ActivationStatus({ state: createEmptyTrackerState(), transitionValid: true, seedsValid: true }).enabled).toBe(false);
    expect(getWeek25ActivationStatus({ state, transitionValid: true, seedsValid: true }).enabled).toBe(true);
  });

  it("creates Closing Split Week 25 state without results, locks, or lost history", () => {
    const original = { ...createEmptyTrackerState(), acceptedSchedule, completedWeeks: [{ week: 22, completedAt: "past" }] };
    const action = activateWeek25({ state: original, transitionValid: true, seedsValid: true, userLeague: "National League", activatedAt: "2026-06-14T01:00:00.000Z" });
    expect(action.errors).toEqual([]);
    expect(action.state.activeWorkflow).toMatchObject({ leagueYear: 2, split: "Closing Split", yearWeek: 25, splitWeek: 1, userLeague: "National League" });
    expect(action.state.completedWeeks).toEqual(original.completedWeeks);
    expect(action.state.confirmedResults).toEqual([]);
    expect(getActiveWorkflowMatches(action.state, []).filter((match) => match.week === 25)).toHaveLength(24);
  });

  it("blocks activation for open Manual Review and conflicting Closing results", () => {
    const reviewState = { ...createEmptyTrackerState(), acceptedSchedule, manualReviews: [{ id: "r", scope: "regular" as const, matchId: matches[0].id, league: matches[0].league, weekOrEvent: "Week 25", wrestlerA: matches[0].wrestlerA, wrestlerB: matches[0].wrestlerB, note: "review", status: "open" as const, createdAt: "now", resolvedAt: null }] };
    expect(getWeek25ActivationStatus({ state: reviewState, transitionValid: true, seedsValid: true }).disabledReason).toContain("Manual Review");
    const resultState = { ...createEmptyTrackerState(), acceptedSchedule, confirmedResults: [{ league: matches[0].league, week: 25, matchId: matches[0].id, wrestlerA: matches[0].wrestlerA, wrestlerB: matches[0].wrestlerB, resultType: "Winner" as const, winner: matches[0].wrestlerA, source: "Manual" as const, confirmedAt: "2026-06-14T00:00:00.000Z" }] };
    expect(getWeek25ActivationStatus({ state: resultState, transitionValid: true, seedsValid: true }).disabledReason).toContain("already-played");
  });
  it("advances active workflow and keeps Week 25 exportable after Closing Split Week 1 lock", () => {
    const activated = activateWeek25({ state: { ...createEmptyTrackerState(), acceptedSchedule }, transitionValid: true, seedsValid: true, userLeague: "National League", activatedAt: "2026-06-14T01:00:00.000Z" });
    expect(activated.errors).toEqual([]);
    const workflowMatches = getActiveWorkflowMatches(activated.state, []);
    const ready = {
      ...activated.state,
      confirmedResults: workflowMatches
        .filter((match) => match.week === 25)
        .map((match) => ({
          league: match.league,
          week: match.week,
          matchId: match.id,
          wrestlerA: match.wrestlerA,
          wrestlerB: match.wrestlerB,
          resultType: "Winner" as const,
          winner: match.wrestlerA,
          source: match.league === "National League" ? "Manual" as const : "Simulation" as const,
          confirmedAt: "2026-06-15T10:00:00.000Z",
        })),
    };
    const locked = completeWeek(ready, 25, workflowMatches, "National League", "2026-06-15T11:00:00.000Z");
    expect(locked.errors).toEqual([]);
    expect(locked.state.completedWeeks.at(-1)?.week).toBe(25);
    expect(locked.state.activeWorkflow).toMatchObject({ split: "Closing Split", yearWeek: 26, splitWeek: 2 });
    expect(detectActiveWeek(locked.state, workflowMatches, 24)).toMatchObject({ activeWeek: 26, latestLockedWeek: 25 });
    expect(getActiveUserLeagueMatches(locked.state, workflowMatches, 24, "National League").every((match) => match.week === 26)).toBe(true);
    const exports = createWeeklyCloseExports(locked.state, workflowMatches, [], "National League", 22, "test.xlsx", "2026-06-15T12:00:00.000Z");
    expect(exports.ok).toBe(true);
    if (!exports.ok) return;
    expect(exports.week).toBe(25);
    expect(exports.package.latestLockedWeek).toBe(25);
  });
});
