import { describe, expect, it } from "vitest";
import { getActiveCurrentUserOptions, resolveCurrentUser } from "../current-user";
import { LEAGUE_NAMES, type StandingRow } from "../types";

function activeRows(): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: league === "National League" && index === 0 ? "Beckielo" : `${league} Wrestler ${index + 1}`,
    seed: index + 1,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: "active",
  })));
}

describe("current user selection", () => {
  it("lists active league roster wrestlers only", () => {
    const rows = [...activeRows(), { ...activeRows()[0], rank: 13, wrestler: "Inactive Wrestler" }];
    const options = getActiveCurrentUserOptions(rows);
    expect(options).toHaveLength(48);
    expect(options.some((option) => option.wrestler === "Inactive Wrestler")).toBe(false);
  });

  it("resolves a stored active wrestler and league", () => {
    expect(resolveCurrentUser(activeRows(), "Global League Wrestler 2")).toEqual({ wrestler: "Global League Wrestler 2", league: "Global League" });
  });

  it("falls back to Beckielo when stored wrestler is invalid", () => {
    expect(resolveCurrentUser(activeRows(), "Unknown Wrestler")).toEqual({ wrestler: "Beckielo", league: "National League" });
  });

  it("falls back to the first active wrestler when Beckielo is unavailable", () => {
    const rows = activeRows().filter((row) => row.wrestler !== "Beckielo");
    expect(resolveCurrentUser(rows, "Unknown Wrestler")?.wrestler).toBe("Global League Wrestler 1");
  });
});
