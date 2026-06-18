import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getLastHeadToHead } from "../head-to-head";
import type { HistoricalMatchResult } from "../match-history";
import { getRecentForm } from "../recent-form";

function source(file: string) { return fs.readFileSync(path.join(process.cwd(), file), "utf8"); }

const history: HistoricalMatchResult[] = [
  { matchId: "y1-s1-w1", league: "Global League", split: "Opening Split", leagueYear: 1, week: 1, wrestlerA: "Alpha", wrestlerB: "Beta", resultType: "Winner", winner: "Beta" },
  { matchId: "y1-s2-w3", league: "Global League", split: "Closing Split", leagueYear: 1, week: 27, wrestlerA: "Alpha", wrestlerB: "Gamma", resultType: "Draw", winner: null },
  { matchId: "y2-s1-w2", league: "Global League", split: "Opening Split", leagueYear: 2, week: 2, wrestlerA: "Delta", wrestlerB: "Alpha", resultType: "Winner", winner: "Delta" },
  { matchId: "y2-s2-w4", league: "Global League", split: "Closing Split", leagueYear: 2, week: 28, wrestlerA: "Alpha", wrestlerB: "Beta", resultType: "Winner", winner: "Alpha" },
];

describe("Phase 10.9.4 dashboard match context", () => {
  it("uses MATCH labels, ranked wrestler names, form slots, and H2H underline classes in dashboard rows", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard).toContain('MATCH {String(match.matchNumber).padStart(2, "0")}');
    expect(dashboard).not.toContain("Bout {String(match.matchNumber)");
    expect(dashboard).toContain("formatRankedWrestler(match.wrestlerA, currentRanks.get(match.wrestlerA))");
    expect(dashboard).toContain("formatRankedWrestler(match.wrestlerB, currentRanks.get(match.wrestlerB))");
    expect(dashboard).toContain("getRecentForm(match.wrestlerA, matchHistory)");
    expect(dashboard).toContain("h2h-last-winner");
  });

  it("formats missing rank without inventing a fake rank", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard).toContain("return rank ? `#${rank} ${wrestler}` : wrestler;");
  });

  it("maps recent form wins, draws/no contests, and losses to emoji outcomes", () => {
    const form = getRecentForm("Alpha", history);
    expect(form.lastOutcomes.map((entry) => entry.emoji)).toEqual(["⬜", "🟥", "🟩"]);
    expect(getRecentForm("Unknown", history).lastOutcomes).toEqual([]);
  });

  it("finds the most recent direct matchup across splits and years and underlines decisive winner only", () => {
    expect(getLastHeadToHead("Alpha", "Beta", history).matchId).toBe("y2-s2-w4");
    expect(getLastHeadToHead("Alpha", "Beta", history).shouldUnderlineLeft).toBe(true);
    expect(getLastHeadToHead("Alpha", "Gamma", history).shouldUnderlineLeft).toBe(false);
    expect(getLastHeadToHead("Alpha", "Gamma", history).shouldUnderlineRight).toBe(false);
    expect(getLastHeadToHead("Alpha", "Omega", history).found).toBe(false);
  });

  it("does not count the current scheduled match as previous H2H history", () => {
    const h2h = getLastHeadToHead("Alpha", "Beta", history, "y2-s2-w4");
    expect(h2h.matchId).toBe("y1-s1-w1");
    expect(h2h.shouldUnderlineRight).toBe(true);
  });

  it("keeps live table compact without horizontal or vertical dashboard scroll containers", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain(".dashboard-live-table-wrap{overflow:visible");
    expect(css).toContain("table-layout:fixed");
    expect(css).toContain("font-size:11px");
    expect(css).not.toContain(".dashboard-live-table-wrap{overflow:auto");
  });
});
