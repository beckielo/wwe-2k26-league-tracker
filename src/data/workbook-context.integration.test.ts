import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { createEmptyTrackerState, reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { resolveWorkflowContextAuthority } from "@/domain/workflow-context";

vi.mock("server-only", () => ({}));

import { loadLegacyTableData, loadMasterWorkbookBuffer, loadTrackerData } from "./workbook";
import { buildSimulationCandidates, resolveSimulationScheduleSource } from "@/domain/simulation";

describe("reconstructed current-master Closing checkpoint", () => {
  it("exposes a non-destructive LY2 Opening archive record without inventing league champions", () => {
    const data = loadTrackerData();

    expect(data.completedSplitHistory).toHaveLength(1);
    expect(data.completedSplitHistory[0]).toMatchObject({
      leagueYear: 2,
      split: "Opening Split",
      completedThroughYearWeek: 24,
      leagueChampions: { status: "missing", data: [] },
      splitWinner: { status: "missing", data: null },
      eliteCup: { status: "confirmed", data: { winner: "Roman Reigns", runnerUp: null } },
    });
    expect(data.completedSplitHistory.some((record) => record.split === "Closing Split")).toBe(false);

    const { buffer } = loadMasterWorkbookBuffer();
    expect(XLSX.read(buffer, { type: "buffer" }).SheetNames).toHaveLength(18);
  });

  it("builds the 18 open Week 37 simulation candidates from the validated App schedule", () => {
    const data = loadTrackerData();
    const appContext = data.workflowContext.appWorkbook;
    expect(appContext?.valid).toBe(true);

    const simulation = buildSimulationCandidates({
      matches: data.matches,
      matchupReference: data.matchupReference,
      leagues: data.leagues,
      standings: data.standings,
      streaks: data.streaks,
      existingResults: data.results,
      userLeague: data.meta.userLeague,
      targetWeek: 37,
      scheduleSource: resolveSimulationScheduleSource({
        activeSource: "app-workbook",
        scheduleSource: appContext?.scheduleSource ?? "",
        hasAcceptedSchedule: false,
      }),
    });

    expect(simulation.errors).toEqual([]);
    expect(simulation.candidates).toHaveLength(18);
    expect(new Set(simulation.candidates.map((candidate) => candidate.match.league))).toEqual(
      new Set(["Global League", "Continental League", "Regional League"]),
    );
  });

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

  it("keeps Dashboard, Schedule_22W, and Standings_Current synchronized to Closing W36", () => {
    const { buffer } = loadMasterWorkbookBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toHaveLength(18);

    const dashboard = new Map(
      XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Dashboard, { header: 1, raw: true })
        .map((row) => [String(row[0] ?? ""), String(row[1] ?? "")]),
    );
    expect(dashboard.get("WWE 2K26 Liga-System")).toContain("League Year 2");
    expect(dashboard.get("WWE 2K26 Liga-System")).toContain("Closing Split");
    expect(dashboard.get("Aktueller Stand")).toBe("Woche 36 abgeschlossen");
    expect(dashboard.get("Ligaphase")).toBe("Closing Split Woche 12 abgeschlossen");
    expect([...dashboard.entries()].find(([key]) => key.endsWith("User-Show"))?.[1])
      .toContain("Closing Split Woche 13");

    const schedule = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Schedule_22W);
    expect(schedule).toHaveLength(528);
    expect(new Set(schedule.map((row) => row.Split))).toEqual(new Set(["Closing Split"]));
    expect(schedule.filter((row) => row.Winner || /^Draw\b|^No Contest\b/i.test(String(row.Notes ?? "")))).toHaveLength(288);

    const fallbackStandings = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Standings_Current);
    const appStandings = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.App_State_Standings);
    expect(fallbackStandings).toEqual(appStandings.map((row) => ({
      League: row.league,
      Rank: row.rank,
      Wrestler: row.wrestler,
      Seed: row.seed,
      Matches: row.matches,
      Wins: row.wins,
      Draws: row.draws,
      Losses: row.losses,
      Points: row.points,
      "Status / Zone": row.status,
    })));
  });

  it("deduplicates synchronized fallback matches and imports all committed Closing results", () => {
    const data = loadTrackerData();
    expect(data.matches).toHaveLength(528);
    expect(data.matches.every((match) => (
      match.leagueYear === 2 && match.split === "Closing Split"
    ))).toBe(true);
    expect(data.results).toHaveLength(288);
    expect(data.results.filter((result) => result.outcome === "draw")).toHaveLength(2);
    expect(data.workflowContext.dashboard).toMatchObject({
      leagueYear: 2,
      split: "Closing Split",
      completedThroughYearWeek: 36,
      activeYearWeek: 37,
    });
    expect(data.workflowContext.dashboard.conflicts).toEqual([]);
  });

  it("loads Closing-compatible H2H and streak analytics from the validated W36 checkpoint", () => {
    const data = loadTrackerData();
    expect(data.headToHead).toHaveLength(288);
    expect(data.headToHead.filter((record) => !record.winner)).toHaveLength(2);
    expect(new Set(data.headToHead.map((record) => record.week))).toEqual(
      new Set(Array.from({ length: 12 }, (_, index) => index + 1)),
    );
    expect(data.streaks).toHaveLength(48);
    expect(data.streaks.find((record) => record.wrestler === "Ilja Dragunov")).toMatchObject({
      currentStreak: 11,
      longestWinningStreak: 11,
      lastResult: "W",
    });
    expect(data.historicalAnalytics).toMatchObject({
      leagueYear: 2,
      split: "Closing Split",
      completedThroughYearWeek: 36,
      completedThroughSplitWeek: 12,
      activeYearWeek: 37,
      activeSplitWeek: 13,
      resultCount: 288,
      decisiveCount: 286,
      drawCount: 2,
      noContestCount: 0,
      rejectedResultCount: 0,
      ignoredContextResultCount: 0,
      headToHeadSheetStatus: "current",
      winningStreakSheetStatus: "current",
    });
    expect(data.validationIssues.filter((issue) => issue.code.startsWith("HISTORICAL_ANALYTICS_"))).toEqual([]);
  });

  it("preserves all-time Legacy records while applying only safe Closing context overlays", () => {
    const legacy = loadLegacyTableData();
    expect(legacy.summary.leagueTitleRecords).toBe(8);
    expect(legacy.summary.eliteCupRecords).toBe(2);
    expect(legacy.baselineCompletedSplitKeys).toEqual(["2:Opening Split"]);
    expect(legacy.profiles.find((profile) => profile.wrestler === "Gunther")).toMatchObject({
      leagueWinsTotal: 2,
      globalChampionWins: 2,
      eliteCupWins: 1,
    });
    expect(legacy.profiles.find((profile) => profile.wrestler === "Randy Orton")?.leagueWinsTotal).toBe(1);
    expect(legacy.profiles.find((profile) => profile.wrestler === "LA Knight")?.leagueWinsTotal).toBe(1);
    expect(legacy.profiles.find((profile) => profile.wrestler === "Dragon Lee")?.leagueWinsTotal).toBe(1);
    expect(legacy.profiles.find((profile) => profile.wrestler === "Roman Reigns")?.eliteCupWins).toBe(1);
    expect(legacy.profiles.find((profile) => profile.wrestler === "Ilja Dragunov")).toMatchObject({
      currentLeague: "Continental League",
      longestWinStreakOverall: 11,
    });
    expect(legacy.summary.audit?.sources).toContainEqual(expect.objectContaining({
      source: expect.stringContaining("031d361"),
      leagueTitleRecords: 4,
      eliteCupRecords: 1,
    }));
    expect(legacy.historicalAnalytics).toMatchObject({
      split: "Closing Split",
      completedThroughYearWeek: 36,
    });
  });
});
