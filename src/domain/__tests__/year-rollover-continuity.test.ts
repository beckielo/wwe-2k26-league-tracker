import { describe, expect, it } from "vitest";
import { deriveLeagueFinalsReview, type LeagueFinalsResult } from "../league-finals";
import { derivePostFinalsTransition, type PostFinalsAssignment } from "../post-finals-transition";
import { LEAGUE_NAMES, type LeagueName, type Match, type StandingRow } from "../types";
import {
  assignContinuitySeeds,
  deriveYearRolloverContinuity,
  SCHEDULE_SOURCE_MISSING_MESSAGE,
  validateNextSplitSchedule,
} from "../year-rollover-continuity";

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league.split(" ")[0]} ${String(index + 1).padStart(2, "0")}`,
    seed: index + 1,
    matches: 22,
    wins: 21 - index,
    draws: 0,
    losses: index + 1,
    points: (21 - index) * 3,
    status: "",
  })),
);

const finals = deriveLeagueFinalsReview({
  completedThroughWeek: 22,
  standings,
  consequentialTies: [],
  hasLeagueFinalsTemplate: true,
});
const finalsMatches = [...finals.nightOne, ...finals.nightTwo];

function completedResults(): LeagueFinalsResult[] {
  const results: LeagueFinalsResult[] = [];
  for (const match of finalsMatches) {
    const winner = match.kind === "Elite Cup Final"
      ? results.find((result) => result.matchId === finalsMatches.find((candidate) => candidate.kind === "Elite Cup Semifinal" && candidate.matchNumber === 4)?.id)?.winner ?? null
      : match.wrestlerA;
    results.push({ matchId: match.id, resultType: "Winner", winner, confirmedAt: "2026-06-14T00:00:00.000Z" });
  }
  return results;
}

function transition(complete = true) {
  return derivePostFinalsTransition({
    completedThroughWeek: 22,
    standings,
    consequentialTies: [],
    matches: finalsMatches,
    results: complete ? completedResults() : [],
    completedNights: complete
      ? [{ night: "Night One", completedAt: "2026-06-14" }, { night: "Night Two", completedAt: "2026-06-14" }]
      : [],
    champions: finals.champions,
    directMovements: finals.directMovements,
    hasAuthoritativeClosingSchedule: false,
  });
}

function doubleRoundRobin(composition: Record<LeagueName, PostFinalsAssignment[]>): Match[] {
  return LEAGUE_NAMES.flatMap((league) => {
    const names = composition[league].map((row) => row.wrestler);
    const rounds: [string, string][][] = [];
    let rotating = [...names];
    for (let round = 0; round < 11; round += 1) {
      rounds.push(Array.from({ length: 6 }, (_, index) => [rotating[index], rotating[11 - index]]));
      rotating = [rotating[0], rotating[11], ...rotating.slice(1, 11)];
    }
    return [...rounds, ...rounds.map((round) => round.map(([a, b]) => [b, a] as [string, string]))]
      .flatMap((round, weekIndex) => round.map(([wrestlerA, wrestlerB], matchIndex) => ({
        id: `${league}-${weekIndex + 1}-${matchIndex + 1}`,
        leagueYear: 2,
        split: "Closing Split" as const,
        week: weekIndex + 1,
        roundType: weekIndex < 11 ? "Hinrunde" as const : "Rückrunde" as const,
        league,
        showDay: "Freitag" as const,
        matchNumber: matchIndex + 1,
        wrestlerA,
        wrestlerB,
        matchupKey: [wrestlerA, wrestlerB].sort().join("|"),
        status: "scheduled" as const,
        source: { file: "test.xlsx", sheet: "Schedule" },
      })));
  });
}

function continuity(options: { complete?: boolean; schedule?: Match[] } = {}) {
  const postFinals = transition(options.complete ?? true);
  return deriveYearRolloverContinuity({
    leagueYear: 2,
    split: "Opening Split",
    completedThroughWeek: 22,
    previousFinalStandings: standings,
    transition: postFinals,
    nextSchedule: options.schedule ?? [],
  });
}

describe("Phase 9.5 completion gates", () => {
  it("remains locked if League Finals are incomplete", () => {
    expect(continuity({ complete: false })).toMatchObject({
      setupAllowed: false,
      nextAction: "Complete League Finals first",
    });
  });

  it("remains locked if Phase 9B transition is invalid", () => {
    const invalid = transition();
    invalid.compositionValid = false;
    const result = deriveYearRolloverContinuity({
      leagueYear: 2, split: "Opening Split", completedThroughWeek: 22,
      previousFinalStandings: standings, transition: invalid, nextSchedule: [],
    });
    expect(result.setupAllowed).toBe(false);
    expect(result.nextAction).toBe("Complete Post-Finals Transition first");
  });

  it("does not start Week 25 or Year 3 without schedule readiness", () => {
    const result = continuity();
    expect(result.scheduleReadiness.message).toBe(SCHEDULE_SOURCE_MISSING_MESSAGE);
    expect(result.week25WorkflowAllowed).toBe(false);
    expect(result.year3WorkflowAllowed).toBe(false);
  });
});

describe("seed continuity", () => {
  it("creates seeds 1–12 exactly once per resulting league and every wrestler exactly once", () => {
    const result = continuity().seedContinuity;
    expect(result.valid).toBe(true);
    for (const league of LEAGUE_NAMES) {
      expect(result.seeds[league].map((row) => row.seed)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    }
    const names = LEAGUE_NAMES.flatMap((league) => result.seeds[league].map((row) => row.wrestler));
    expect(names).toHaveLength(48);
    expect(new Set(names).size).toBe(48);
  });

  it("uses prior league tier and final rank rather than previous seed or subjective prestige", () => {
    const result = continuity().seedContinuity.seeds["Global League"];
    expect(result[0]).toMatchObject({ wrestler: "Global 01", priorRank: 1 });
    expect(result.find((row) => row.wrestler === "Continental 01")?.seed).toBe(12);
    expect(result.every((row) => !row.orderingReason.toLowerCase().includes("prestige"))).toBe(true);
  });

  it("uses alphabetical order only as the deterministic final seed fallback", () => {
    const base = transition().leagueComposition;
    const tied = structuredClone(base);
    tied["Global League"][0] = { ...tied["Global League"][0], wrestler: "Zulu", priorLeague: "Global League", priorRank: 5, finalsOutcome: null };
    tied["Global League"][1] = { ...tied["Global League"][1], wrestler: "Alpha", priorLeague: "Global League", priorRank: 5, finalsOutcome: null };
    const finalRows = standings.map((row, index) => index === 0 ? { ...row, wrestler: "Zulu" } : index === 1 ? { ...row, wrestler: "Alpha" } : row);
    const result = assignContinuitySeeds(finalRows, tied);
    const alpha = result.seeds["Global League"].findIndex((row) => row.wrestler === "Alpha");
    const zulu = result.seeds["Global League"].findIndex((row) => row.wrestler === "Zulu");
    expect(alpha).toBeLessThan(zulu);
    expect(result.orderingExplanation).toContain("seed/order generation only");
    expect(result.orderingExplanation).toContain("never resolve standings or competition outcomes");
  });

  it("rejects duplicate and missing wrestlers", () => {
    const composition = structuredClone(transition().leagueComposition);
    composition["Global League"][1].wrestler = composition["Global League"][0].wrestler;
    const result = assignContinuitySeeds(standings, composition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Duplicate wrestlers");
    expect(result.errors.join(" ")).toContain("missing");
  });
});

describe("schedule readiness and factual history", () => {
  it("accepts a valid authoritative 22-week double round robin", () => {
    const postFinals = transition();
    const schedule = doubleRoundRobin(postFinals.leagueComposition);
    expect(validateNextSplitSchedule(schedule, postFinals.leagueComposition)).toMatchObject({ ready: true, errors: [] });
    expect(continuity({ schedule })).toMatchObject({ setupAllowed: true, week25WorkflowAllowed: true });
  });

  it("rejects an invalid schedule source", () => {
    const postFinals = transition();
    const schedule = doubleRoundRobin(postFinals.leagueComposition).slice(1);
    const readiness = validateNextSplitSchedule(schedule, postFinals.leagueComposition);
    expect(readiness.ready).toBe(false);
    expect(readiness.errors.length).toBeGreaterThan(0);
  });

  it("preserves factual history without calculating GOAT rankings", () => {
    const result = continuity();
    expect(result.historyFacts).toContainEqual(expect.objectContaining({ label: "Global League Champion", leagueYear: 2 }));
    expect(result.historyFacts).toContainEqual(expect.objectContaining({ label: "Direct Promotion" }));
    expect(result.legacyFormulaMessage).toBe("Legacy formula Review Required — facts preserved only.");
    expect(result).not.toHaveProperty("goatRanking");
    expect(result).not.toHaveProperty("goatPoints");
  });
});
