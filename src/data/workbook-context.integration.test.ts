import { describe, expect, it, vi } from "vitest";
import { createEmptyTrackerState, reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { resolveWorkflowContextAuthority } from "@/domain/workflow-context";

vi.mock("server-only", () => ({}));

import { loadTrackerData } from "./workbook";

describe("reconstructed current-master Closing checkpoint", () => {
  it("loads the committed W36 App checkpoint as the high-confidence authority", () => {
    const data = loadTrackerData();
    const authority = resolveWorkflowContextAuthority(
      data.workflowContext,
      createEmptyTrackerState(),
      true,
    );
    expect(data.sourceFile).toContain("LY2_Closing_W36");
    expect(data.workflowContext.selected).toBe("app-workbook");
    expect(data.workflowContext.appWorkbook).toMatchObject({
      valid: true,
      leagueYear: 2,
      split: "Closing Split",
      completedThroughYearWeek: 36,
      activeYearWeek: 37,
      splitWeek: 13,
      confidence: "high",
    });
    expect(authority).toMatchObject({
      activeSource: "app-workbook",
      split: "Closing Split",
      completedThroughYearWeek: 36,
      activeYearWeek: 37,
      splitWeek: 13,
      confidence: "high",
    });
    expect(authority.conflicts).toEqual([]);
  });

  it("keeps one twelve-match row per accepted-schedule wrestler and ignores stale older W46 logs", () => {
    const data = loadTrackerData();
    const closingMatches = data.matches.filter((match) => (
      match.leagueYear === 2 && match.split === "Closing Split"
    ));
    const scheduleLeagueByWrestler = new Map(
      closingMatches.flatMap((match) => [
        [match.wrestlerA, match.league] as const,
        [match.wrestlerB, match.league] as const,
      ]),
    );
    expect(closingMatches).toHaveLength(528);
    expect(data.standings).toHaveLength(48);
    expect(data.standings.every((row) => (
      row.matches === 12
      && scheduleLeagueByWrestler.get(row.wrestler) === row.league
    ))).toBe(true);
    expect(data.appWritebackResults).toHaveLength(24);
    expect(new Set(data.appWritebackResults.map((result) => result.week))).toEqual(new Set([36]));
    expect(data.meta.latestAppWritebackWeek).toBe(36);
    expect(data.meta.latestAppWritebackCompletedAt).toBe("2026-07-03T22:45:23.399Z");
  });

  it("renders the persisted W36 table as baseline instead of resetting it to the latest result sheet", () => {
    const data = loadTrackerData();
    const live = reconstructActiveSplitLiveStandings({
      previousFinalStandings: data.standings,
      scheduledMatches: data.matches,
      masterResults: data.results,
      localResults: [],
      split: "Closing Split",
      completedThroughWeek: 36,
      baselineCompletedThroughYearWeek: 36,
      activeLeagueYear: 2,
    });
    expect(live.diagnostics).toEqual([]);
    expect(live.standings).toEqual(data.standings);
    expect(live.standings.every((row) => row.matches === 12)).toBe(true);
  });

  it("applies a local W37 result on top of the persisted W36 baseline", () => {
    const data = loadTrackerData();
    const match = data.matches.find((candidate) => (
      candidate.leagueYear === 2
      && candidate.split === "Closing Split"
      && candidate.week === 37
    ));
    expect(match).toBeDefined();
    if (!match) return;

    const live = reconstructActiveSplitLiveStandings({
      previousFinalStandings: data.standings,
      scheduledMatches: data.matches,
      masterResults: data.results,
      localResults: [{
        league: match.league,
        week: match.week,
        matchId: match.id,
        wrestlerA: match.wrestlerA,
        wrestlerB: match.wrestlerB,
        resultType: "Winner",
        winner: match.wrestlerA,
        source: "Manual",
        confirmedAt: "2026-07-04T12:00:00.000Z",
      }],
      split: "Closing Split",
      completedThroughWeek: 37,
      baselineCompletedThroughYearWeek: 36,
      activeLeagueYear: 2,
    });

    expect(live.diagnostics).toEqual([]);
    expect(live.standings.find((row) => row.wrestler === match.wrestlerA)?.matches).toBe(13);
    expect(live.standings.find((row) => row.wrestler === match.wrestlerB)?.matches).toBe(13);
    expect(live.standings.filter((row) => row.matches === 12)).toHaveLength(46);
  });
});
