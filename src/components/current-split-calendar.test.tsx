// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfirmedResult, TrackerState } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type StandingRow } from "@/domain/types";
import { CurrentSplitCalendar } from "./current-split-calendar";

let state: TrackerState;

vi.mock("@/state/tracker-state-provider", () => ({
  useTrackerState: () => ({
    state,
    authority: {
      leagueYear: 2,
      split: "Closing Split",
      activeSource: "local",
    },
    hydrated: true,
  }),
}));

function match(id: string, league: LeagueName, week: number): Match {
  return {
    id,
    leagueYear: 2,
    split: "Closing Split",
    week,
    roundType: "Hinrunde",
    league,
    showDay: league === "Global League" ? "Freitag" : league === "Continental League" ? "Mittwoch" : league === "National League" ? "Dienstag" : "Montag",
    matchNumber: 1,
    wrestlerA: `${league} A`,
    wrestlerB: `${league} B`,
    matchupKey: `${league}:${week}`,
    status: "scheduled",
    source: { file: "test", sheet: "schedule" },
  };
}

const matches = [25, 26].flatMap((week) => LEAGUE_NAMES.map((league) => match(`${league}-${week}`, league, week)));
const workbookResults: MatchResult[] = matches.filter((entry) => entry.week === 25).map((entry) => ({
  matchId: entry.id,
  outcome: "decisive",
  winner: entry.wrestlerA,
  loser: entry.wrestlerB,
  resultSource: entry.league === "National League" ? "User" : "Simulation",
  notes: null,
  source: { file: "test", sheet: "results" },
}));
const week26National = matches.find((entry) => entry.id === "National League-26")!;
const week26Global = matches.find((entry) => entry.id === "Global League-26")!;

function localResult(source: Match, resultSource: ConfirmedResult["source"]): ConfirmedResult {
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

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) => [
  { league, rank: 1, wrestler: `${league} A`, seed: 1, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "" },
  { league, rank: 2, wrestler: `${league} B`, seed: 2, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "" },
]);

function renderCalendar() {
  return render(
    <CurrentSplitCalendar
      matches={matches}
      workbookResults={workbookResults}
      workbookCompletedThroughWeek={25}
      standings={standings}
      userLeague="National League"
    />,
  );
}

describe("CurrentSplitCalendar", () => {
  afterEach(cleanup);

  it("navigates completed matchdays and separates user from simulated leagues", () => {
    state = {
      version: 1,
      confirmedResults: [
        localResult(week26National, "Manual"),
        localResult(week26Global, "Simulation"),
      ],
      completedWeeks: [],
      lastExportedAt: null,
      lastImportedAt: null,
      currentUserWrestler: "National League A",
    };
    renderCalendar();

    expect(screen.getByText("Split Week 2")).toBeVisible();
    expect(screen.getByLabelText("National League calendar results")).toHaveTextContent("User-controlled league");
    expect(screen.getByLabelText("Global League calendar results")).toHaveTextContent("Simulated league");
    expect(screen.getByText("Manual result / Confirmed")).toBeVisible();
    expect(screen.getByText("Simulated result / Confirmed")).toBeVisible();
    const resultPreview = screen.getByLabelText("Confirmed result preview");
    expect(resultPreview).toHaveClass("week-match-preview", "calendar-result-preview");
    expect(resultPreview.querySelector(".match-preview-backdrop")).toBeInTheDocument();
    expect(within(resultPreview).getByText("Manual result")).toBeVisible();

    fireEvent.click(within(resultPreview).getByRole("button", { name: "Next Result" }));
    expect(within(resultPreview).getByText("Simulated result")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Week 1/ }));

    expect(screen.getByText("Split Week 1")).toBeVisible();
    expect(screen.getByLabelText("National League calendar results")).toHaveTextContent("National League A won");
    expect(screen.getByLabelText("Global League calendar results")).toHaveTextContent("Global League A won");
  });

  it("provides a full current-split wrestler timeline", () => {
    state = {
      version: 1,
      confirmedResults: [localResult(week26National, "Manual")],
      completedWeeks: [],
      lastExportedAt: null,
      lastImportedAt: null,
      currentUserWrestler: "National League A",
    };
    renderCalendar();

    fireEvent.change(screen.getByLabelText("Wrestler view"), {
      target: { value: "National League A" },
    });

    const timeline = screen.getByLabelText("National League A current split timeline");
    expect(within(timeline).getByText("2 confirmed matches")).toBeVisible();
    expect(within(timeline).getByText("Split Week 1")).toBeVisible();
    expect(within(timeline).getByText("Split Week 2")).toBeVisible();
    expect(within(timeline).getAllByText("User League")).toHaveLength(2);
  });

  it("renders a truthful empty state when no confirmed results exist", () => {
    state = {
      version: 1,
      confirmedResults: [],
      completedWeeks: [],
      lastExportedAt: null,
      lastImportedAt: null,
      currentUserWrestler: "National League A",
    };
    render(
      <CurrentSplitCalendar
        matches={matches}
        workbookResults={[]}
        workbookCompletedThroughWeek={24}
        standings={standings}
        userLeague="National League"
      />,
    );

    expect(screen.getByLabelText("No calendar results")).toHaveTextContent("No confirmed results yet");
    expect(screen.queryByText("Split Week 1")).not.toBeInTheDocument();
  });
});
