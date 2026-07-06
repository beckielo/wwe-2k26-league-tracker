import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWeekReviewMiniStandingsRows } from "@/components/week-review";
import { getLastCompletedSplitChampionMetadata, getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";
import type { StandingRow } from "@/domain/types";

const dashboardSource = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
const appShellSource = readFileSync("src/components/app-shell.tsx", "utf8");
const weekReviewSource = readFileSync("src/components/week-review.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

const latestCompletedCommit: CompletedSplitLegacyCommit = {
  sourceSignature: "phase-19ac-current-fixture",
  committedAt: "2026-06-24T00:00:00.000Z",
  leagueYear: 2,
  split: "Opening Split",
  titleRecords: [
    { league: "Global League", wrestler: "Gunther" },
    { league: "Continental League", wrestler: "Randy Orton" },
    { league: "National League", wrestler: "LA Knight" },
    { league: "Regional League", wrestler: "Dragon Lee" },
  ],
  eliteCupWinner: "Roman Reigns",
  eliteCupRunnerUp: "Gunther",
};

describe("Phase 19AC final metadata and week review UI cleanup", () => {
  it("moves the legacy link to quick navigation and removes dashboard-only legacy copy", () => {
    expect(appShellSource).toContain('["Legacy Table", "/legacy", "history"]');
    expect(dashboardSource).not.toContain("Open Legacy Table");
    expect(dashboardSource).not.toContain("Career Archive · honours, streaks and invincible runs");
    expect(dashboardSource).not.toContain("league title records · {props.legacySummary.eliteCupWinners} Elite Cup records");
    expect(dashboardSource).not.toContain("8 league title records · 2 Elite Cup records");
  });

  it("resolves current fixture champion metadata and color roles without making Gunther purple", () => {
    const metadata = getLastCompletedSplitChampionMetadata([latestCompletedCommit]);
    expect(metadata).toMatchObject({
      globalChampion: "Gunther",
      continentalChampion: "Randy Orton",
      nationalChampion: "LA Knight",
      regionalChampion: "Dragon Lee",
      eliteCupWinner: "Roman Reigns",
      eliteCupRunnerUp: "Gunther",
    });
    const roles = getPreviousSplitChampionColorRoles(undefined, [latestCompletedCommit]);
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).not.toBe("double-winner");
  });

  it("accepts compact league-name metadata so Continental still maps Randy Orton to the Continental Champion role", () => {
    const compactCommit = { ...latestCompletedCommit, titleRecords: latestCompletedCommit.titleRecords.map((record) => record.league === "Continental League" ? { ...record, league: "Continental" as never } : record) };
    const roles = getPreviousSplitChampionColorRoles(undefined, [compactCommit]);
    expect(getLastCompletedSplitChampionMetadata([compactCommit])?.continentalChampion).toBe("Randy Orton");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
  });

  it("defines a Continental Champion blue token that is not normal white, gray, or generic silver", () => {
    expect(cssSource).toContain("--achievement-continental-champion:#3B82F6");
    expect(cssSource).toContain("--league-continental:#83b9dc");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-continental-champion{color:var(--achievement-continental-champion)}");
    expect(cssSource).toContain(".dashboard-show-name-content.name-color-continental-champion{color:var(--achievement-continental-champion)}");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-normal{color:#fff}");
    expect(cssSource).not.toContain("name-color-continental-champion{color:silver}");
    expect(cssSource).not.toContain("name-color-continental-champion{color:#C0C0C0}");
    expect(cssSource).not.toContain("--achievement-continental-champion:#B7C7DB");
    expect(cssSource).not.toContain("name-color-continental-champion{color:#fff}");
    expect(cssSource).not.toContain("name-color-continental-champion{color:gray}");
    expect(cssSource).not.toContain("name-color-continental-champion{color:grey}");
  });

  it("builds newly started split mini standings from active roster order with zero results and no previous/finals points", () => {
    const stalePreviousSplitRows: StandingRow[] = [
      { league: "Global League", rank: 1, seed: 3, wrestler: "Gunther", matches: 22, wins: 20, draws: 0, losses: 2, points: 60, status: "Opening Split Champion" },
      { league: "Global League", rank: 2, seed: 1, wrestler: "Roman Reigns", matches: 22, wins: 18, draws: 1, losses: 3, points: 55, status: "Elite Cup Winner" },
      { league: "Global League", rank: 3, seed: 2, wrestler: "Randy Orton", matches: 22, wins: 17, draws: 1, losses: 4, points: 52, status: "Continental Champion" },
    ];
    const activeWeekOneRows = stalePreviousSplitRows.map((row) => ({ ...row, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "post-finals schedule composition" }));
    const rows = buildWeekReviewMiniStandingsRows(activeWeekOneRows);
    expect(rows.map((row) => row.wrestler)).toEqual(["Roman Reigns", "Randy Orton", "Gunther"]);
    expect(rows.every((row) => row.matches === 0 && row.wins === 0 && row.draws === 0 && row.losses === 0 && row.points === 0)).toBe(true);
    expect(Math.max(...rows.map((row) => row.points))).toBe(0);
  });

  it("uses champion metadata only on mini standings wrestler names", () => {
    expect(weekReviewSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(weekReviewSource).toContain("championRoles={championRoles}");
    expect(weekReviewSource).toContain('className="mini-standings-points"><strong>{row.points}</strong>');
    expect(weekReviewSource).not.toContain('mini-standings-points"><WrestlerNameWithRole');
  });
});
