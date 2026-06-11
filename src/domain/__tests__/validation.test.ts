import { describe, expect, it } from "vitest";
import { validateLeagueRosters, validateResultEntry, validateSchedule } from "../validation";
import type { League, Match } from "../types";

function match(index: number, wrestlerA = `Wrestler ${index * 2 - 1}`, wrestlerB = `Wrestler ${index * 2}`): Match {
  return {
    id: `national-14-${index}`, leagueYear: 2, split: "Opening Split", week: 14, roundType: "Rückrunde",
    league: "National League", showDay: "Dienstag", matchNumber: index, wrestlerA, wrestlerB,
    matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "), status: "scheduled",
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  };
}

function league(names: string[]): League {
  return {
    id: "national-league", name: "National League", showDay: "Dienstag",
    wrestlers: names.map((name, index) => ({ wrestler: { id: name.toLowerCase().replaceAll(" ", "-"), name }, seed: index + 1, startStatus: null })),
  };
}

describe("schedule validation", () => {
  it("accepts six matches with 12 unique wrestlers", () => {
    expect(validateSchedule(Array.from({ length: 6 }, (_, index) => match(index + 1)))).toEqual([]);
  });

  it("detects missing matches and duplicate weekly appearances", () => {
    const issues = validateSchedule([
      match(1, "Alpha", "Beta"),
      match(2, "Alpha", "Gamma"),
    ]);
    expect(issues.map((issue) => issue.code)).toContain("MATCH_COUNT_INVALID");
    expect(issues.map((issue) => issue.code)).toContain("DUPLICATE_WEEK_APPEARANCE");
  });
});

describe("duplicate wrestler validation", () => {
  it("detects a duplicate wrestler in a league", () => {
    const names = Array.from({ length: 12 }, (_, index) => `Wrestler ${index + 1}`);
    names[11] = "Wrestler 1";
    expect(validateLeagueRosters([league(names)]).map((issue) => issue.code)).toContain("DUPLICATE_WRESTLER_IN_LEAGUE");
  });
});

describe("invalid matchup validation", () => {
  const scheduled = Array.from({ length: 6 }, (_, index) => match(index + 1));

  it("rejects a result whose matchup is not in the schedule", () => {
    expect(validateResultEntry({ matchId: "invented-match", winner: "Alpha" }, scheduled)).toEqual({
      valid: false,
      message: "This matchup is not present in the authoritative schedule.",
    });
  });

  it("rejects a winner who is not in the scheduled matchup", () => {
    expect(validateResultEntry({ matchId: scheduled[0].id, winner: "Outsider" }, scheduled).valid).toBe(false);
  });

  it("accepts a scheduled participant as winner", () => {
    expect(validateResultEntry({ matchId: scheduled[0].id, winner: scheduled[0].wrestlerA }, scheduled)).toMatchObject({ valid: true, loser: scheduled[0].wrestlerB });
  });
});
