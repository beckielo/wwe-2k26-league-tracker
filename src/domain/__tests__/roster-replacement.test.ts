import { expect, it } from "vitest";
import { createEmptyTrackerState } from "../tracker-state";
import { applyRosterReplacementsToMatches, isRosterReplacementWindow, replaceWrestler } from "../roster-replacement";
import type { Match, StandingRow } from "../types";

const leagues = ["Global League", "Continental League", "National League", "Regional League"] as const;
const roster: StandingRow[] = leagues.flatMap((league) => Array.from({ length: 12 }, (_, index) => ({
  league, rank: index + 1, wrestler: `${league.split(" ")[0]} ${index + 1}`, seed: index + 1, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "",
})));
const match = (week: number, wrestlerA = "Global 1"): Match => ({ id: `m${week}`, leagueYear: 2, split: "Opening Split", week, roundType: week <= 11 ? "Hinrunde" : "Rückrunde", league: "Global League", showDay: "Freitag", matchNumber: 1, wrestlerA, wrestlerB: "Global 2", matchupKey: `${wrestlerA}::Global 2`, status: "scheduled", source: { file: "test", sheet: "test" } });

it("locks during normal active weeks and unlocks after the Hinrunde", () => {
  expect(isRosterReplacementWindow(createEmptyTrackerState()).unlocked).toBe(false);
  expect(isRosterReplacementWindow({ ...createEmptyTrackerState(), activeWorkflow: { leagueYear: 2, split: "Closing Split", yearWeek: 25, splitWeek: 1, scheduleSource: "accepted generated snapshot", acceptedScheduleAt: "now", activatedAt: "now", userLeague: "Global League" } }).unlocked).toBe(false);
  expect(isRosterReplacementWindow({ ...createEmptyTrackerState(), completedWeeks: [{ week: 11, completedAt: "now" }] })).toMatchObject({ unlocked: true, windowType: "After Hinrunde" });
});

it("unlocks post-finals before the next segment starts", () => {
  expect(isRosterReplacementWindow({ ...createEmptyTrackerState(), completedFinalsNights: [{ night: "Night One", completedAt: "now" }, { night: "Night Two", completedAt: "now" }] })).toMatchObject({ unlocked: true, windowType: "Post-finals" });
});

it("rejects empty and duplicate active wrestler names", () => {
  const state = { ...createEmptyTrackerState(), completedWeeks: [{ week: 11, completedAt: "now" }] };
  expect(replaceWrestler({ state, activeRoster: roster, matches: [match(12)], league: "Global League", oldWrestler: "Global 1", newWrestler: " ", leagueYear: 2, split: "Opening Split", week: 11 }).ok).toBe(false);
  expect(replaceWrestler({ state, activeRoster: roster, matches: [match(12)], league: "Global League", oldWrestler: "Global 1", newWrestler: " global   2 ", leagueYear: 2, split: "Opening Split", week: 11 }).ok).toBe(false);
});

it("keeps active roster at 48, updates current user, and logs replacement", () => {
  const state = { ...createEmptyTrackerState(), completedWeeks: [{ week: 11, completedAt: "now" }], currentUserWrestler: "Global 1" };
  const result = replaceWrestler({ state, activeRoster: roster, matches: [match(12)], league: "Global League", oldWrestler: "Global 1", newWrestler: "New Star", leagueYear: 2, split: "Opening Split", week: 11, now: "2026-01-01T00:00:00.000Z" });
  expect(result.ok).toBe(true);
  expect(result.state.currentUserWrestler).toBe("New Star");
  expect(result.state.rosterReplacements).toHaveLength(1);
});

it("updates future scheduled matches only and does not rewrite completed results", () => {
  const replacement = { id: "r", timestamp: "now", windowType: "After Hinrunde" as const, oldWrestler: "Global 1", newWrestler: "New Star", league: "Global League" as const, leagueYear: 2, split: "Opening Split", week: 11, note: "new wrestler starts from 0" as const };
  const updated = applyRosterReplacementsToMatches([match(10), match(12), match(13)], [replacement], new Set(["m13"]));
  expect(updated[0].wrestlerA).toBe("Global 1");
  expect(updated[1].wrestlerA).toBe("New Star");
  expect(updated[2].wrestlerA).toBe("Global 1");
});
