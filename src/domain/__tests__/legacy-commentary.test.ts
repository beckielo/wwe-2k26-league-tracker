import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import { LEGACY_COLUMNS, parseLegacyTracker } from "../legacy";

const base: LegacyProfile = {
  wrestler: "Test Wrestler",
  currentLeague: "National League",
  goatStatusTier: null,
  leagueWinsTotal: 0,
  globalChampionWins: 0,
  eliteCupWins: 0,
  doubles: 0,
  invincibleSplits: 0,
  invincibleHinrunden: 0,
  invincibleRueckrunden: 0,
  longestWinStreakOverall: 0,
  sourceCommentary: null,
};

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("legacy journalist commentary", () => {
  it("is deterministic for unchanged authoritative stats", () => {
    expect(generateLegacyCommentary(base)).toEqual(generateLegacyCommentary({ ...base }));
  });

  it("changes when a relevant achievement changes", () => {
    const before = generateLegacyCommentary(base);
    const after = generateLegacyCommentary({ ...base, eliteCupWins: 1 });
    expect(after).not.toEqual(before);
    expect(after.category).toBe("Elite Cup Specialist");
    expect(after.evidenceTags).toContain("Elite Cup Winner");
  });

  it("does not claim unavailable titles, cups, promotions, or invincible runs", () => {
    const commentary = generateLegacyCommentary(base);
    expect(commentary.text).not.toMatch(/champion|cup win|promotion|invincible/i);
    expect(commentary.evidenceTags).toEqual([]);
  });

  it("weights titles, Elite Cup wins, streaks, and invincible runs from actual fields", () => {
    expect(generateLegacyCommentary({ ...base, leagueWinsTotal: 1 }).category).toBe("Dominant Champion");
    expect(generateLegacyCommentary({ ...base, eliteCupWins: 1 }).category).toBe("Elite Cup Specialist");
    expect(generateLegacyCommentary({ ...base, longestWinStreakOverall: 9 }).category).toBe("Streak-Based Threat");
    expect(generateLegacyCommentary({ ...base, invincibleSplits: 1 }).category).toBe("Invincible Run Candidate");
  });

  it("uses checkpoint trends only when supplied", () => {
    const collapse = generateLegacyCommentary({ ...base, checkpoints: { hinrundePosition: 1, finalPosition: 6 } });
    const improvement = generateLegacyCommentary({ ...base, checkpoints: { previousSplitPosition: 9, finalPosition: 3 } });
    expect(collapse.category).toBe("Late-Season Collapse");
    expect(collapse.evidenceTags).toContain("Late Collapse");
    expect(improvement.category).toBe("Split-to-Split Improvement");
    expect(improvement.evidenceTags).toContain("Previous Split Improvement");
  });

  it("produces different analysis for clearly different profiles", () => {
    const champion = generateLegacyCommentary({ ...base, wrestler: "Champion", currentLeague: "Global League", leagueWinsTotal: 2, globalChampionWins: 2 });
    const streaker = generateLegacyCommentary({ ...base, wrestler: "Streaker", longestWinStreakOverall: 8 });
    expect(champion.text).not.toBe(streaker.text);
    expect(champion.category).not.toBe(streaker.category);
  });
});

describe("Phase 10.7 legacy table integration", () => {
  it("parses every existing workbook metric without dropping columns", () => {
    const workbookPath = path.join(process.cwd(), "source-docs", fs.readdirSync(path.join(process.cwd(), "source-docs")).find((file) => file.endsWith(".xlsx"))!);
    const data = parseLegacyTracker(XLSX.readFile(workbookPath));
    expect(data.columns).toEqual(LEGACY_COLUMNS);
    expect(data.profiles.length).toBeGreaterThan(40);
    expect(data.profiles[0]).toEqual(expect.objectContaining({
      wrestler: expect.any(String),
      currentLeague: expect.any(String),
      leagueWinsTotal: expect.any(Number),
      globalChampionWins: expect.any(Number),
      eliteCupWins: expect.any(Number),
      doubles: expect.any(Number),
      invincibleSplits: expect.any(Number),
      invincibleHinrunden: expect.any(Number),
      invincibleRueckrunden: expect.any(Number),
      longestWinStreakOverall: expect.any(Number),
    }));
  });

  it("exposes the route from Dashboard and navigation while retaining History", () => {
    expect(source("src/app/legacy/page.tsx")).toContain("LegacyTable");
    expect(source("src/components/dashboard-control-center.tsx")).toContain('href="/legacy"');
    expect(source("src/components/dashboard-control-center.tsx")).toContain("Open Legacy Table");
    expect(source("src/components/app-shell.tsx")).toContain('["Legacy", "/legacy"');
    expect(source("src/components/app-shell.tsx")).toContain('["History", "/history"');
    expect(source("src/app/history/page.tsx")).toContain("HistoryDashboard");
  });

  it("keeps commentary out of the compact row and provides a selectable side panel", () => {
    const component = source("src/components/legacy-table.tsx");
    expect(component).toContain("legacy-table-wrap");
    expect(component).toContain("legacy-commentary");
    expect(component).toContain("Journalist view");
    expect(component).toContain("evidence-tags");
  });
});
