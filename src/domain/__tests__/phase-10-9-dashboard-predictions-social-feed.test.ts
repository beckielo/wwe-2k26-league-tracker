import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { predictMatch, generateSocialFeed } from "../match-predictions";
import type { Match, StandingRow } from "../types";
import type { ConfirmedResult } from "../tracker-state";

const standings: StandingRow[] = Array.from({ length: 12 }, (_, i) => ({ league: "National League", rank: i + 1, wrestler: i === 0 ? "Ace" : i === 4 ? "Beta" : `N${i}`, seed: i + 1, matches: i === 0 ? 5 : i === 4 ? 5 : 1, wins: i === 0 ? 5 : i === 4 ? 1 : 0, draws: 0, losses: i === 0 ? 0 : i === 4 ? 4 : 1, points: i === 0 ? 15 : i === 4 ? 3 : 0, status: "" }))
  .concat(["Global League", "Continental League", "Regional League"].flatMap((league) => Array.from({ length: 12 }, (_, i) => ({ league: league as StandingRow["league"], rank: i + 1, wrestler: `${league} ${i + 1}`, seed: i + 1, matches: i < 2 ? 4 : 1, wins: i === 0 ? 4 : 0, draws: 0, losses: i === 0 ? 0 : 1, points: i === 0 ? 12 : 0, status: "" }))));
const match: Match = { id: "m1", leagueYear: 2, split: "Closing Split", week: 30, roundType: "Hinrunde", league: "National League", showDay: "Mittwoch", matchNumber: 1, wrestlerA: "Ace", wrestlerB: "Beta", matchupKey: "Ace-Beta", status: "scheduled", source: { file: "test", sheet: "Schedule" } };
const results: ConfirmedResult[] = [
  { league: "National League", week: 25, matchId: "r1", wrestlerA: "Ace", wrestlerB: "Beta", resultType: "Winner", winner: "Ace", source: "Manual", confirmedAt: "x" },
  { league: "National League", week: 26, matchId: "r2", wrestlerA: "Ace", wrestlerB: "N2", resultType: "Winner", winner: "Ace", source: "Manual", confirmedAt: "x" },
];

describe("Phase 10.9 dashboard predictions and social feed", () => {
  it("keeps dashboard diagnostics out of the main grid and adds live table, predictions, and social feed UI", () => {
    const source = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
    expect(source).not.toContain("<AlertCenter blocking=");
    expect(source).toContain("Current user league live table");
    expect(source).toContain("Prediction · Win Chance");
    expect(source).toContain("League Social Feed");
  });

  it("returns deterministic capped probabilities that sum to 100 and favor stronger table/form/H2H data", () => {
    const first = predictMatch(match, standings, results);
    const second = predictMatch(match, standings, results);
    expect(first).toEqual(second);
    expect(first.probabilityA + first.probabilityB).toBe(100);
    expect(first.probabilityA).toBeGreaterThan(first.probabilityB);
    expect(first.probabilityA).toBeLessThanOrEqual(85);
    expect(first.probabilityB).toBeGreaterThanOrEqual(15);
    expect(first.factors).toEqual(expect.arrayContaining(["table position", "recent form", "head-to-head"]));
  });

  it("stays near neutral when available data is weak", () => {
    const neutral = predictMatch({ ...match, wrestlerA: "Unknown A", wrestlerB: "Unknown B" }, [], []);
    expect(neutral.probabilityA).toBeGreaterThanOrEqual(45);
    expect(neutral.probabilityA).toBeLessThanOrEqual(55);
    expect(neutral.dataQualityWarnings.length).toBeGreaterThan(0);
  });

  it("renders deterministic 3-6 comments from all leagues and changes when events change", () => {
    const comments = generateSocialFeed(standings, [match], results, "National League");
    expect(comments.length).toBeGreaterThanOrEqual(3);
    expect(comments.length).toBeLessThanOrEqual(6);
    expect(comments).toEqual(generateSocialFeed(standings, [match], results, "National League"));
    expect(new Set(comments.map((c) => c.leagueTag)).size).toBeGreaterThan(1);
    const changed = generateSocialFeed(standings.map((row) => row.wrestler === "Ace" ? { ...row, wins: 4, losses: 1, points: 12 } : row), [match], results, "National League");
    expect(changed.map((c) => c.text)).not.toEqual(comments.map((c) => c.text));
  });
});
