import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateStandingsWithConfirmedResults, type ConfirmedResult } from "../tracker-state";
import type { Match, StandingRow } from "../types";

const dashboardSource = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
const switcherSource = readFileSync("src/components/current-user-switcher.tsx", "utf8");
const resultEntrySource = readFileSync("src/components/result-entry-form.tsx", "utf8");
const simulationWorkflowSource = readFileSync("src/components/simulation-workflow.tsx", "utf8");
const simulationDomainSource = readFileSync("src/domain/simulation.ts", "utf8");

function match(): Match {
  return {
    id: "national-25-1",
    leagueYear: 2,
    split: "Closing Split",
    week: 25,
    roundType: "Hinrunde",
    league: "National League",
    showDay: "Dienstag",
    matchNumber: 1,
    wrestlerA: "Alpha",
    wrestlerB: "Beta",
    matchupKey: "Alpha vs Beta",
    status: "scheduled",
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  };
}

function baseline(source: Match): StandingRow[] {
  return [
    { league: source.league, rank: 1, wrestler: source.wrestlerA, seed: 1, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "start" },
    { league: source.league, rank: 2, wrestler: source.wrestlerB, seed: 2, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "start" },
  ];
}

function result(source: Match, resultType: ConfirmedResult["resultType"], winner: string | null): ConfirmedResult {
  return {
    league: source.league,
    week: source.week,
    matchId: source.id,
    wrestlerA: source.wrestlerA,
    wrestlerB: source.wrestlerB,
    resultType,
    winner,
    source: "Manual",
    confirmedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("Phase 18A dashboard/results/simulation UI polish", () => {
  it("keeps Current User selector custom and clickable without rendering the yellow arrow icon", () => {
    expect(switcherSource).toContain("current-user-trigger");
    expect(switcherSource).toContain("setIsOpen((open) => !open)");
    expect(switcherSource).not.toContain("current-user-trigger-icon");
  });

  it("adds dashboard navigation for result entry, simulation, and week review", () => {
    expect(dashboardSource).toContain("Enter card results");
    expect(dashboardSource).toContain('href="/simulation"');
    expect(dashboardSource).toContain('href="/week-review"');
  });

  it("renders Draw and No Contest choices in the Result Entry winner grid", () => {
    expect(resultEntrySource).toContain('value="Draw"');
    expect(resultEntrySource).toContain('value="No Contest"');
    expect(resultEntrySource).toContain('{ resultType: "Draw", winner: null }');
    expect(resultEntrySource).toContain('{ resultType: "No Contest", winner: null }');
    expect(resultEntrySource).toContain('data-selected={checked ? "true" : "false"}');
  });

  it("removes the simulation explanatory info box without removing protection logic", () => {
    expect(simulationWorkflowSource).not.toContain("Active week only");
    expect(simulationWorkflowSource).not.toContain("Confirmed matches excluded");
    expect(simulationWorkflowSource).not.toContain("User league protected");
    expect(simulationDomainSource).toContain("match.league !== input.userLeague");
    expect(simulationDomainSource).toContain("confirmedMatchIds");
    expect(simulationDomainSource).toContain("targetWeek");
  });

  it("keeps the simulation workbench available after confirmation so results can be undone", () => {
    expect(simulationWorkflowSource).toContain("hasConfirmedSimulationForWeek");
    expect(simulationWorkflowSource).toContain(
      "simulation.candidates.length === 0 && !hasConfirmedSimulationForWeek",
    );
  });

  it("awards win/loss results as 3/0", () => {
    const source = match();
    const rows = calculateStandingsWithConfirmedResults(baseline(source), [source], [result(source, "Winner", source.wrestlerA)]);
    expect(rows.find((row) => row.wrestler === source.wrestlerA)).toMatchObject({ matches: 1, wins: 1, draws: 0, losses: 0, points: 3 });
    expect(rows.find((row) => row.wrestler === source.wrestlerB)).toMatchObject({ matches: 1, wins: 0, draws: 0, losses: 1, points: 0 });
  });

  it.each(["Draw", "No Contest"] as const)("awards %s as 1 point to both wrestlers", (resultType) => {
    const source = match();
    const rows = calculateStandingsWithConfirmedResults(baseline(source), [source], [result(source, resultType, null)]);
    expect(rows.find((row) => row.wrestler === source.wrestlerA)).toMatchObject({ matches: 1, wins: 0, draws: 1, losses: 0, points: 1 });
    expect(rows.find((row) => row.wrestler === source.wrestlerB)).toMatchObject({ matches: 1, wins: 0, draws: 1, losses: 0, points: 1 });
  });
});
