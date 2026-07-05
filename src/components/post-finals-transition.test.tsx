// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildLeagueFinalsMatchIdentity, deriveLeagueFinalsReview, type LeagueFinalsResult } from "@/domain/league-finals";
import { TRACKER_STATE_STORAGE_KEY, createEmptyTrackerState, type TrackerState } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type StandingRow } from "@/domain/types";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import { PostFinalsTransitionView } from "./post-finals-transition";
import { ScheduleSetupView } from "./schedule-setup";

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league.split(" ")[0]} ${index + 1}`,
    seed: index + 1,
    matches: 22,
    wins: 22 - index,
    draws: 0,
    losses: index,
    points: (22 - index) * 3,
    status: "",
  })),
);

const finals = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings, consequentialTies: [], hasLeagueFinalsTemplate: true });
const finalsMatches = [...finals.nightOne, ...finals.nightTwo];

function completedFinalsResults(): LeagueFinalsResult[] {
  const results: LeagueFinalsResult[] = [];
  for (const match of finalsMatches) {
    const semifinalWinner = results.find((result) => result.matchId === finalsMatches.find((candidate) => candidate.kind === "Elite Cup Semifinal" && candidate.matchNumber === 4)?.id)?.winner ?? null;
    results.push({
      matchId: match.id,
      resultType: "Winner",
      winner: match.kind === "Elite Cup Final" ? semifinalWinner : match.wrestlerA,
      confirmedAt: "2026-06-23T00:00:00.000Z",
      matchIdentity: buildLeagueFinalsMatchIdentity(match),
    });
  }
  return results;
}

function renderTransition(state?: Partial<TrackerState>) {
  window.localStorage.clear();
  if (state) window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify({ ...createEmptyTrackerState(), ...state }));
  return render(
    <TrackerStateProvider>
      <PostFinalsTransitionView
        completedThroughWeek={22}
        leagueYear={2}
        split="Opening Split"
        standings={standings}
        matches={[]}
        results={[]}
        matchupReference={[]}
        hasLeagueFinalsTemplate
        hasAuthoritativeClosingSchedule={false}
      />
    </TrackerStateProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PostFinalsTransitionView composition acceptance", () => {
  it("disables review while League Finals are incomplete", async () => {
    renderTransition();
    const button = await screen.findByRole("button", { name: "Review New League Composition" });
    expect(button).toBeDisabled();
    expect(screen.getAllByText("Complete League Finals first.")[0]).toBeInTheDocument();
  });

  it("opens confirmation, cancel does not persist, and accept persists the 4x12 baseline", async () => {
    renderTransition({
      leagueFinalsResults: completedFinalsResults(),
      completedFinalsNights: [
        { night: "Night One", completedAt: "2026-06-23T00:00:00.000Z" },
        { night: "Night Two", completedAt: "2026-06-23T00:00:00.000Z" },
      ],
    });

    const button = await screen.findByRole("button", { name: "Review New League Composition" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Accept New League Composition?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}").acceptedPostFinalsComposition).toBeUndefined();

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Accept Composition" }));
    await waitFor(() => expect(screen.getByText("Post-Finals composition accepted")).toBeInTheDocument());
    const stored = JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}") as TrackerState;
    const accepted = stored.acceptedPostFinalsComposition!;
    expect(LEAGUE_NAMES.map((league) => accepted.rosters[league].length)).toEqual([12, 12, 12, 12]);
    expect(new Set(LEAGUE_NAMES.flatMap((league) => accepted.rosters[league].map((row) => row.wrestler))).size).toBe(48);
    expect(stored.acceptedSchedule).toBeUndefined();
    expect(stored.activeWorkflow).toBeUndefined();
  });

  it("hydrates the accepted state after reload", async () => {
    const acceptedState = createEmptyTrackerState();
    const transition = renderTransition({
      leagueFinalsResults: completedFinalsResults(),
      completedFinalsNights: [
        { night: "Night One", completedAt: "2026-06-23T00:00:00.000Z" },
        { night: "Night Two", completedAt: "2026-06-23T00:00:00.000Z" },
      ],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Review New League Composition" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept Composition" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Next Split" })).toBeInTheDocument());
    const stored = JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}") as TrackerState;
    transition.unmount();

    renderTransition({ ...acceptedState, ...stored });
    expect(await screen.findByText("Post-Finals composition accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Composition Accepted" })).toBeDisabled();
  });

  it("lets Schedule Setup see the accepted baseline without auto-generating fixtures", async () => {
    renderTransition({
      leagueFinalsResults: completedFinalsResults(),
      completedFinalsNights: [
        { night: "Night One", completedAt: "2026-06-23T00:00:00.000Z" },
        { night: "Night Two", completedAt: "2026-06-23T00:00:00.000Z" },
      ],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Review New League Composition" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept Composition" }));
    await waitFor(() => expect(screen.getByText("Post-Finals composition accepted")).toBeInTheDocument());
    cleanup();

    render(
      <TrackerStateProvider>
        <ScheduleSetupView
          completedThroughWeek={22}
          leagueYear={2}
          split="Opening Split"
          standings={standings}
          matches={[]}
          results={[]}
          matchupReference={[]}
          hasLeagueFinalsTemplate
          userWrestler="Global 1"
          userLeague="Global League"
        />
      </TrackerStateProvider>,
    );

    expect(await screen.findByText("Closing Split Setup Ready")).toBeInTheDocument();
    expect(screen.getByText("The reviewed post-finals league composition is accepted and ready as the Closing Split starting point.")).toBeInTheDocument();
    expect(screen.getByText("48 wrestlers")).toBeInTheDocument();
    expect(screen.getByText("no duplicates")).toBeInTheDocument();
    expect(screen.getByText("No preview — generate the Closing Split schedule first.")).toBeInTheDocument();
    expect(screen.queryByText("Generated · 528 matches")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}").acceptedSchedule).toBeUndefined();
  });

  it("generates from the accepted post-finals roster and explicitly starts Closing Split Week 1", async () => {
    renderTransition({
      leagueFinalsResults: completedFinalsResults(),
      completedFinalsNights: [
        { night: "Night One", completedAt: "2026-06-23T00:00:00.000Z" },
        { night: "Night Two", completedAt: "2026-06-23T00:00:00.000Z" },
      ],
      currentUserWrestler: "National 3",
      confirmedResults: [{ league: "National League", week: 25, matchId: "old", wrestlerA: "Old A", wrestlerB: "Old B", resultType: "Winner", winner: "Old A", source: "Manual", confirmedAt: "2026-06-23T00:00:00.000Z" }],
      completedWeeks: [{ week: 25, completedAt: "2026-06-23T00:00:00.000Z" }],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Review New League Composition" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept Composition" }));
    await waitFor(() => expect(screen.getByText("Post-Finals composition accepted")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Start Next Split" }));
    expect(screen.getByRole("dialog", { name: "Start Next Split?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}") as TrackerState).activeWorkflow).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Start Next Split" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Start Next Split" }).at(-1)!);
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY) ?? "{}") as TrackerState;
      expect(stored.acceptedSchedule?.matches).toHaveLength(528);
      expect(stored.acceptedSchedule?.matches.every((match) => match.yearWeek! >= 25 && match.yearWeek! <= 46)).toBe(true);
      expect(stored.acceptedSchedule?.matches.some((match) => match.wrestlerA === "National 3" || match.wrestlerB === "National 3")).toBe(true);
      expect(stored.activeWorkflow).toMatchObject({ leagueYear: 2, split: "Closing Split", yearWeek: 25, splitWeek: 1, userLeague: "National League" });
      expect(stored.confirmedResults).toHaveLength(0);
      expect(stored.completedWeeks).toHaveLength(0);
      expect(stored.leagueFinalsResults).toHaveLength(finalsMatches.length);
      expect(stored.postFinalsTransitionCompleted).toMatchObject({ nextLeagueYear: 2, nextSplit: "Closing Split" });
      expect(stored.workflowContextCheckpoint).toMatchObject({
        scope: "user-workflow",
        acceptedScheduleSignature: expect.stringMatching(/^workflow-/),
      });
    });
  });

  it("does not silently regenerate after the next split is already active", async () => {
    renderTransition({
      leagueFinalsResults: completedFinalsResults(),
      completedFinalsNights: [
        { night: "Night One", completedAt: "2026-06-23T00:00:00.000Z" },
        { night: "Night Two", completedAt: "2026-06-23T00:00:00.000Z" },
      ],
      currentUserWrestler: "National 3",
    });
    fireEvent.click(await screen.findByRole("button", { name: "Review New League Composition" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept Composition" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Next Split" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Start Next Split" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Start Next Split" }).at(-1)!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Next Split Active" })).toBeDisabled());
    expect(screen.getByRole("link", { name: "Open Dashboard" })).toHaveAttribute("href", "/");
  });
});
