import { describe, expect, it } from "vitest";
import {
  buildPrecedingSplitHistory,
  createCompletedSplitHistoryRecord,
  type CompletedSplitHistoryInput,
} from "../completed-split-history";
import type { WorkflowContextCandidate } from "../workflow-context";
import { LEAGUE_NAMES, type StandingRow } from "../types";

function completionInput(overrides: Partial<CompletedSplitHistoryInput> = {}): CompletedSplitHistoryInput {
  return {
    leagueYear: 2,
    split: "Opening Split",
    completion: {
      leagueYear: 2,
      split: "Opening Split",
      status: "confirmed",
      source: "Validated split completion",
      data: { completedThroughYearWeek: 24, completedAt: null },
    },
    leagueChampions: {
      leagueYear: 2,
      split: "Opening Split",
      status: "missing",
      source: "No confirmed champion source",
      data: [],
    },
    sourceSignature: "completed-split-history-test",
    sourceWorkbook: "test.xlsx",
    sourceCheckpoint: "2:Closing Split:36",
    createdAt: null,
    confidence: "medium",
    dataSource: "test",
    ...overrides,
  };
}

function context(): WorkflowContextCandidate {
  return {
    source: "app-workbook",
    valid: true,
    leagueYear: 2,
    split: "Closing Split",
    activeYearWeek: 37,
    completedThroughYearWeek: 36,
    splitWeek: 13,
    phase: "regular-season",
    scheduleSource: "App_Accepted_Schedule",
    standingsSource: "App_State_Standings",
    resultsSource: "App_Confirmed_Results",
    finalsReadiness: "not-ready",
    sourceSignature: "closing-w36",
    confidence: "high",
    conflicts: [],
  };
}

function standings(): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league} Wrestler ${index + 1}`,
    seed: index + 1,
    matches: 22,
    wins: 11,
    draws: 0,
    losses: 11,
    points: 33,
    status: index === 0 ? "Champion" : "Final",
  })));
}

describe("Completed Split History archive v1", () => {
  it("marks a completed split with no confirmed champion source without inventing a champion", () => {
    const record = createCompletedSplitHistoryRecord(completionInput());

    expect(record).not.toBeNull();
    expect(record?.leagueChampions).toMatchObject({ status: "missing", data: [] });
    expect(record?.splitWinner).toMatchObject({ status: "not-archived", data: null });
  });

  it("does not archive the active Closing Split before its Year Week 48 boundary", () => {
    const record = createCompletedSplitHistoryRecord(completionInput({
      split: "Closing Split",
      completion: {
        leagueYear: 2,
        split: "Closing Split",
        status: "confirmed",
        source: "Current checkpoint",
        data: { completedThroughYearWeek: 36, completedAt: null },
      },
    }));

    expect(record).toBeNull();
  });

  it("does not mix an Opening champion source into a Closing archive", () => {
    const record = createCompletedSplitHistoryRecord(completionInput({
      split: "Closing Split",
      completion: {
        leagueYear: 2,
        split: "Closing Split",
        status: "confirmed",
        source: "Completed Closing source",
        data: { completedThroughYearWeek: 48, completedAt: null },
      },
      leagueChampions: {
        leagueYear: 2,
        split: "Opening Split",
        status: "confirmed",
        source: "Opening fallback",
        data: LEAGUE_NAMES.map((league) => ({ league, wrestler: `${league} Opening Winner` })),
      },
    }));

    expect(record?.leagueChampions).toMatchObject({ status: "missing", data: [] });
    expect(record?.conflicts.join(" ")).toContain("another League Year or split");
  });

  it("can accept a later confirmed champion, standings, Finals, movement and split-winner source", () => {
    const champions = LEAGUE_NAMES.map((league) => ({ league, wrestler: `${league} Winner` }));
    const source = <T,>(data: T) => ({
      leagueYear: 2,
      split: "Opening Split" as const,
      status: "confirmed" as const,
      source: "Confirmed Finals archive",
      data,
    });
    const record = createCompletedSplitHistoryRecord(completionInput({
      finalStandings: source(standings()),
      splitWinner: source({ wrestler: "Confirmed Split Winner" }),
      leagueChampions: source(champions),
      leagueFinals: source([{ event: "Night Two", result: "Confirmed result" }]),
      eliteCup: source({ winner: "Confirmed Cup Winner", runnerUp: "Confirmed Runner-up" }),
      movements: source({ promoted: ["Promoted Wrestler"], relegated: ["Relegated Wrestler"] }),
    }));

    expect(record?.finalStandings.status).toBe("confirmed");
    expect(record?.splitWinner.data).toBe("Confirmed Split Winner");
    expect(record?.leagueChampions.data).toEqual(champions);
    expect(record?.eliteCup.data.winner).toBe("Confirmed Cup Winner");
    expect(record?.movements.status).toBe("confirmed");
  });

  it("creates the LY2 Opening predecessor archive with only the separately confirmed Elite Cup fact", () => {
    const records = buildPrecedingSplitHistory({
      currentContext: context(),
      sourceWorkbook: "closing-w36.xlsx",
      confirmedEliteCupWinner: {
        leagueYear: 2,
        split: "Opening Split",
        wrestler: "Roman Reigns",
        source: "User-confirmed historical correction",
      },
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      leagueYear: 2,
      split: "Opening Split",
      completedThroughYearWeek: 24,
      leagueChampions: { status: "missing", data: [] },
      eliteCup: { status: "confirmed", data: { winner: "Roman Reigns", runnerUp: null } },
    });
    expect(records.some((record) => record.split === "Closing Split")).toBe(false);
  });

  it("does not mutate supplied final standings while normalizing archive data", () => {
    const sourceStandings = standings();
    const before = structuredClone(sourceStandings);
    const scopedStandings = {
      leagueYear: 2,
      split: "Opening Split" as const,
      status: "confirmed" as const,
      source: "Confirmed final standings",
      data: sourceStandings,
    };

    createCompletedSplitHistoryRecord(completionInput({ finalStandings: scopedStandings }));

    expect(sourceStandings).toEqual(before);
  });
});
