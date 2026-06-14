import { describe, expect, it } from "vitest";
import { closeManualReview, completeWeek, createEmptyTrackerState, markManualReview } from "../tracker-state";
import type { Match } from "../types";

const matches: Match[] = Array.from({ length: 24 }, (_, index) => ({
  id: `m-${index}`, leagueYear: 2, split: "Opening Split", week: 14, roundType: "Rückrunde",
  league: index < 6 ? "National League" : "Global League", showDay: index < 6 ? "Mittwoch" : "Montag",
  matchNumber: (index % 6) + 1, wrestlerA: `A${index}`, wrestlerB: `B${index}`,
  matchupKey: `A${index}__B${index}`, status: "scheduled", source: { file: "master.xlsx", sheet: "Schedule_22W" },
}));

function completeResults() {
  return matches.map((match) => ({
    league: match.league, week: 14, matchId: match.id, wrestlerA: match.wrestlerA, wrestlerB: match.wrestlerB,
    resultType: "Winner" as const, winner: match.wrestlerA, source: "Manual" as const, confirmedAt: "2026-06-14T12:00:00.000Z",
  }));
}

describe("Manual Review", () => {
  it("opens without inventing a result and persists its note", () => {
    const action = markManualReview(createEmptyTrackerState(), {
      scope: "regular", matchId: "m-0", league: "National League", weekOrEvent: "Week 14",
      wrestlerA: "A0", wrestlerB: "B0", note: "Simulation was interrupted.",
    }, "2026-06-14T12:00:00.000Z");
    expect(action.ok).toBe(true);
    expect(action.state.confirmedResults).toEqual([]);
    expect(action.state.manualReviews?.[0]).toMatchObject({ status: "open", note: "Simulation was interrupted.", resolvedAt: null });
  });

  it("blocks a week lock until cleared or resolved", () => {
    const base = { ...createEmptyTrackerState(), confirmedResults: completeResults() };
    const opened = markManualReview(base, {
      scope: "regular", matchId: "m-0", league: "National League", weekOrEvent: "Week 14",
      wrestlerA: "A0", wrestlerB: "B0", note: "Wrong wrestler appeared.",
    }).state;
    expect(completeWeek(opened, 14, matches, "National League").errors.join(" ")).toContain("open Manual Review");
    const cleared = closeManualReview(opened, opened.manualReviews![0].id, "cleared").state;
    expect(completeWeek(cleared, 14, matches, "National League").ok).toBe(true);
  });

  it("records resolution timestamps without adding a finish type", () => {
    const opened = markManualReview(createEmptyTrackerState(), {
      scope: "regular", matchId: "m-0", league: "National League", weekOrEvent: "Week 14",
      wrestlerA: "A0", wrestlerB: "B0", note: "Unclear ending.",
    }).state;
    const resolved = closeManualReview(opened, opened.manualReviews![0].id, "resolved", "2026-06-14T13:00:00.000Z");
    expect(resolved.state.manualReviews?.[0]).toMatchObject({ status: "resolved", resolvedAt: "2026-06-14T13:00:00.000Z" });
    expect(resolved.state.manualReviews?.[0]).not.toHaveProperty("finishType");
  });
});
