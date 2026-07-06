// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmedResult, TrackerState } from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";
import { LEAGUE_NAMES } from "@/domain/types";
import { WeekReview } from "./week-review";

const trackerHarness = vi.hoisted(() => ({
  initialState: null as TrackerState | null,
}));

vi.mock("@/state/tracker-state-provider", async () => {
  const React = await import("react");

  return {
    useTrackerState: () => {
      const [state, setState] = React.useState<TrackerState>(
        () => structuredClone(trackerHarness.initialState!),
      );
      const completedThroughYearWeek = state.completedWeeks.reduce(
        (latest, entry) => Math.max(latest, entry.week),
        36,
      );
      const activeSource = completedThroughYearWeek > 36 ? "local" : "app-workbook";

      return {
        state,
        authority: {
          source: activeSource,
          activeSource,
          leagueYear: 2,
          split: "Closing Split",
          activeYearWeek: completedThroughYearWeek + 1,
          completedThroughYearWeek,
          splitWeek: completedThroughYearWeek - 23,
          phase: "regular-season",
          scheduleSource: "Saved schedule",
          standingsSource: "Saved standings",
          resultsSource: "Saved results",
          finalsReadiness: "not-ready",
          sourceSignature: `week-review-${completedThroughYearWeek}`,
          confidence: "high",
          conflicts: [],
          localStateAccepted: true,
          blockingConflicts: [],
          diagnosticNotices: [],
          rejectedSources: [],
        },
        replaceState: setState,
        exportState: () => JSON.stringify(state),
        importState: () => [],
        resetState: () => setState({
          version: 1,
          confirmedResults: [],
          completedWeeks: [],
          lastExportedAt: null,
          lastImportedAt: null,
        }),
        hydrated: true,
      };
    },
  };
});

vi.mock("./promote-current-master", () => ({
  PromoteCurrentMaster: () => <div>Advanced data tools</div>,
}));

function weeklyMatches(): Match[] {
  return LEAGUE_NAMES.flatMap((league, leagueIndex) =>
    Array.from({ length: 6 }, (_, index) => ({
      id: `${leagueIndex}-${index + 1}`,
      leagueYear: 2,
      split: "Closing Split" as const,
      week: 37,
      roundType: "Rückrunde" as const,
      league,
      showDay: (
        league === "Regional League"
          ? "Montag"
          : league === "National League"
            ? "Dienstag"
            : league === "Continental League"
              ? "Mittwoch"
              : "Freitag"
      ) as Match["showDay"],
      matchNumber: index + 1,
      wrestlerA: `${league} A${index + 1}`,
      wrestlerB: `${league} B${index + 1}`,
      matchupKey: `${league}-${index + 1}`,
      status: "scheduled" as const,
      source: { file: "test", sheet: "test" },
    })),
  );
}

function baseline(matches: Match[]): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => {
    const leagueMatches = matches.filter((match) => match.league === league);
    return leagueMatches.flatMap((match, index) => [
      {
        league,
        rank: index + 1,
        wrestler: match.wrestlerA,
        seed: index + 1,
        matches: 12,
        wins: 6,
        draws: 0,
        losses: 6,
        points: 18,
        status: "Current",
      },
      {
        league,
        rank: index + 7,
        wrestler: match.wrestlerB,
        seed: index + 7,
        matches: 12,
        wins: 6,
        draws: 0,
        losses: 6,
        points: 18,
        status: "Current",
      },
    ]);
  });
}

function results(matches: Match[], userLeague: LeagueName): ConfirmedResult[] {
  return matches.map((match) => ({
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: match.league === userLeague ? "Manual" : "Simulation",
    confirmedAt: "2026-07-06T12:00:00.000Z",
  }));
}

describe("WeekReview permanent mini preview", () => {
  const matches = weeklyMatches();
  const userLeague: LeagueName = "National League";

  beforeEach(() => {
    trackerHarness.initialState = {
      version: 1,
      confirmedResults: results(matches, userLeague),
      completedWeeks: [],
      lastExportedAt: null,
      lastImportedAt: null,
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the review table visible and updates its locked-week state after complete and unlock", async () => {
    render(
      <WeekReview
        allMatches={matches}
        baselineStandings={baseline(matches)}
        workbookResults={[]}
        matchupReference={[]}
        leagueYear={2}
        split="Closing Split"
        hasLeagueFinalsTemplate={false}
        userLeague={userLeague}
        workbookCurrentWeek={36}
        sourceFile="current-master.xlsx"
        userWrestler="National League A1"
      />,
    );

    const preview = screen.getByLabelText("Mini live standings preview");
    expect(preview).toBeVisible();
    expect(preview.closest("details")).toBeNull();
    expect(screen.getByText("Current week")).toBeVisible();
    expect(screen.getByText("Advanced backup and data export").closest("details"))
      .not.toContainElement(preview);

    fireEvent.click(screen.getByRole("button", { name: "Complete & lock Week 37" }));

    await waitFor(() => {
      expect(within(screen.getByLabelText("Mini live standings preview"))
        .getByText(/updated through locked Year Week 37/)).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Unlock Week 37 with warning" }));

    await waitFor(() => {
      expect(within(screen.getByLabelText("Mini live standings preview"))
        .queryByText(/updated through locked Year Week 37/)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Week 37 unlocked/)).toBeVisible();
  });
});
