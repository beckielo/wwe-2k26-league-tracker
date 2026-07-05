// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmedResult, TrackerState } from "@/domain/tracker-state";
import type { Match } from "@/domain/types";
import { SimulationWorkbench } from "./simulation-workbench";

const replaceState = vi.fn();
let state: TrackerState;

vi.mock("@/state/tracker-state-provider", () => ({
  useTrackerState: () => ({
    state,
    replaceState,
    hydrated: true,
  }),
}));

function match(
  id: string,
  league: Match["league"],
  wrestlerA: string,
  wrestlerB: string,
): Match {
  return {
    id,
    leagueYear: 2,
    split: "Closing Split",
    week: 37,
    roundType: "Rückrunde",
    league,
    showDay: league === "National League" ? "Dienstag" : "Montag",
    matchNumber: 1,
    wrestlerA,
    wrestlerB,
    matchupKey: `${wrestlerA} vs ${wrestlerB}`,
    status: "scheduled",
    source: { file: "test", sheet: "test" },
  };
}

const manualMatch = match("national-37-1", "National League", "Manual A", "Manual B");
const simulatedMatch = match("regional-37-1", "Regional League", "Sim A", "Sim B");
const secondSimulatedMatch = match(
  "continental-37-1",
  "Continental League",
  "Second Sim A",
  "Second Sim B",
);

function result(source: Match, resultSource: ConfirmedResult["source"]): ConfirmedResult {
  return {
    league: source.league,
    week: source.week,
    matchId: source.id,
    wrestlerA: source.wrestlerA,
    wrestlerB: source.wrestlerB,
    resultType: "Winner",
    winner: source.wrestlerA,
    source: resultSource,
    confirmedAt: "2026-07-06T12:00:00.000Z",
  };
}

function renderWorkbench() {
  return render(
    <SimulationWorkbench
      week={37}
      weekLabel="Closing Split Week 13"
      candidates={[]}
      scheduledMatches={[manualMatch, simulatedMatch, secondSimulatedMatch]}
      existingResults={[]}
      userLeague="National League"
    />,
  );
}

describe("SimulationWorkbench confirmed simulation undo", () => {
  afterEach(cleanup);

  beforeEach(() => {
    replaceState.mockClear();
    state = {
      version: 1,
      confirmedResults: [
        result(manualMatch, "Manual"),
        result(simulatedMatch, "Simulation"),
        result(secondSimulatedMatch, "Simulation"),
      ],
      completedWeeks: [],
      lastExportedAt: null,
      lastImportedAt: null,
    };
  });

  it("offers an undo action after simulation results are confirmed", () => {
    renderWorkbench();

    expect(screen.getByRole("button", { name: "Undo confirmed simulation" }))
      .toBeEnabled();
  });

  it("removes only current-week simulation results and preserves manual user-league results", () => {
    renderWorkbench();

    fireEvent.click(screen.getByRole("button", { name: "Undo confirmed simulation" }));

    expect(replaceState).toHaveBeenCalledTimes(1);
    const nextState = replaceState.mock.calls[0][0] as TrackerState;
    expect(nextState.confirmedResults).toEqual([result(manualMatch, "Manual")]);
    expect(nextState.confirmedResults.some((entry) => entry.source === "Simulation")).toBe(false);
  });

  it("blocks undo when the week is completed and locked", () => {
    state = {
      ...state,
      completedWeeks: [{ week: 37, completedAt: "2026-07-06T12:05:00.000Z" }],
    };
    renderWorkbench();

    const undo = screen.getByRole("button", { name: "Undo confirmed simulation" });
    expect(undo).toBeDisabled();
    fireEvent.click(undo);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
