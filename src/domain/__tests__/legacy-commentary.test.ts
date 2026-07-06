import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { generateLegacyCommentary, legacyTier, sortLegacyProfiles, type LegacyProfile } from "../legacy-commentary";
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
    expect(after.evidenceTags).toContain("1 Elite Cup Win");
  });

  it("separates a category badge, row excerpt, and full-sentence commentary", () => {
    const commentary = generateLegacyCommentary(base);
    expect(commentary.category).toBe("Lower League Climber");
    expect(commentary.text).toMatch(/[.!?]$/);
    expect(commentary.text.split(/[.!?]+/).filter((sentence) => sentence.trim()).length).toBeGreaterThanOrEqual(1);
    expect(commentary.excerpt).not.toBe(commentary.category);
    expect(commentary.excerpt).toMatch(/[.!?…]$/);
  });

  it("does not claim unavailable titles, cups, promotions, or invincible runs", () => {
    const commentary = generateLegacyCommentary(base);
    expect(commentary.feature).toBe(false);
    expect(commentary.text).not.toMatch(/champion|promotion|invincible/i);
    expect(commentary.evidenceTags).toEqual([]);
  });

  it("weights titles, Elite Cup wins, streaks, and invincible runs from actual fields", () => {
    expect(generateLegacyCommentary({ ...base, leagueWinsTotal: 1 }).category).toBe("League Title Standard");
    expect(generateLegacyCommentary({ ...base, leagueWinsTotal: 1, globalChampionWins: 1 }).category).toBe("Global Championship Standard");
    expect(generateLegacyCommentary({ ...base, eliteCupWins: 1 }).category).toBe("Elite Cup Specialist");
    expect(generateLegacyCommentary({ ...base, longestWinStreakOverall: 9 }).category).toBe("Streak-Based Threat");
    expect(generateLegacyCommentary({ ...base, invincibleSplits: 1 }).category).toBe("Invincible Run Candidate");
  });

  it("does not overuse streak commentary when stronger title or trophy evidence exists", () => {
    expect(generateLegacyCommentary({ ...base, longestWinStreakOverall: 12, leagueWinsTotal: 1 }).category).toBe("League Title Standard");
    expect(generateLegacyCommentary({ ...base, longestWinStreakOverall: 12, eliteCupWins: 1 }).category).toBe("Elite Cup Specialist");
    expect(generateLegacyCommentary({ ...base, longestWinStreakOverall: 12, globalChampionWins: 1 }).category).toBe("Global Championship Standard");
  });

  it("uses checkpoint trends only when supplied", () => {
    const collapse = generateLegacyCommentary({ ...base, checkpoints: { hinrundePosition: 1, finalPosition: 6 } });
    const improvement = generateLegacyCommentary({ ...base, checkpoints: { previousSplitPosition: 9, finalPosition: 3 } });
    expect(collapse.category).toBe("Late-Season Collapse");
    expect(collapse.evidenceTags).toContain("Finished P6 from P1");
    expect(improvement.category).toBe("Split-to-Split Improvement");
    expect(improvement.evidenceTags).toContain("Improved P9 to P3");
  });

  it("produces different analysis for clearly different profiles", () => {
    const champion = generateLegacyCommentary({ ...base, wrestler: "Champion", currentLeague: "Global League", leagueWinsTotal: 2, globalChampionWins: 2 });
    const streaker = generateLegacyCommentary({ ...base, wrestler: "Streaker", longestWinStreakOverall: 8 });
    expect(champion.text).not.toBe(streaker.text);
    expect(champion.category).not.toBe(streaker.category);
  });

  it("gives a top achievement profile expanded evidence-based commentary", () => {
    const commentary = generateLegacyCommentary({
      ...base,
      wrestler: "Archive Leader",
      currentLeague: "Global League",
      leagueWinsTotal: 2,
      globalChampionWins: 1,
      eliteCupWins: 1,
      longestWinStreakOverall: 8,
    });
    const sentences = commentary.text.split(/[.!?]+/).filter((sentence) => sentence.trim());
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeGreaterThanOrEqual(4);
    expect(commentary.feature).toBe(true);
    expect(commentary.text).toMatch(/Global Championship|Global title/i);
    expect(commentary.evidenceTags).toEqual(expect.arrayContaining(["1 Global Title", "2 League Titles", "1 Elite Cup Win", "8-Match Win Streak"]));
    expect(commentary.statCallouts).toContainEqual({ label: "Global titles", value: "1" });
  });

  it("gives Tier B wrestlers a compact path to A/S without inventing achievements", () => {
    const commentary = generateLegacyCommentary({ ...base, wrestler: "Beckielo", leagueWinsTotal: 1, longestWinStreakOverall: 5 });
    expect(commentary.feature).toBe(false);
    expect(commentary.text).toMatch(/Tier B|Tier A|Tier S/i);
    expect(commentary.text).toMatch(/missing/i);
    expect(commentary.text).toMatch(/Global League title|Elite Cup win|invincible split|repeated title-level/i);
    expect(commentary.text).not.toMatch(/already includes .*Elite Cup win/i);
    expect(commentary.text).not.toMatch(/already includes .*Global League title/i);
  });

  it("keeps Tier C and D commentary minimal rather than feature-length", () => {
    const commentary = generateLegacyCommentary({ ...base, longestWinStreakOverall: 4 });
    expect(commentary.feature).toBe(false);
    expect(commentary.text).toMatch(/Tier C/i);
    expect(commentary.text).not.toMatch(/What is missing for Tier A or Tier S/i);
  });

  it("keeps evidence tags aligned with recorded fields", () => {
    const commentary = generateLegacyCommentary({ ...base, eliteCupWins: 2, invincibleRueckrunden: 1 });
    expect(commentary.evidenceTags).toContain("2 Elite Cup Wins");
    expect(commentary.evidenceTags).toContain("1 Invincible Rückrunde");
    expect(commentary.evidenceTags.join(" ")).not.toMatch(/Global|League Title|Streak/);
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

  it("exposes the route from quick navigation while retaining History", () => {
    expect(source("src/app/legacy/page.tsx")).toContain("LegacyTable");
    expect(source("src/components/dashboard-control-center.tsx")).not.toContain('href="/legacy"');
    expect(source("src/components/dashboard-control-center.tsx")).not.toContain("Open Legacy Table");
    expect(source("src/components/app-shell.tsx")).toContain('["Legacy Table", "/legacy"');
    expect(source("src/components/dashboard-control-center.tsx")).not.toContain("Career Archive · honours, streaks and invincible runs");
    expect(source("src/components/dashboard-control-center.tsx")).not.toContain("Current legacy leader");
    expect(source("src/components/app-shell.tsx")).toContain('["History", "/history"');
    expect(source("src/app/history/page.tsx")).toContain("HistoryDashboard");
  });

  it("keeps commentary out of the compact row and provides a selectable side panel", () => {
    const component = source("src/components/legacy-table.tsx");
    expect(component).toContain("legacy-table-wrap");
    expect(component).toContain("legacy-commentary");
    expect(component).not.toContain("Journalist view");
    expect(component).toContain("evidence-tags");
    expect(component).not.toContain("rowCommentary.excerpt");
    expect(component).toContain("commentary.statCallouts");
    expect(component).toContain("Recorded evidence");
    expect(component).toContain("legacy-column-groups");
    expect(component).not.toContain("<th>Rank</th>");
    expect(component).not.toContain("<th>Commentary</th>");
  });

  it("assigns only S-D tiers and sorts by tier then alphabetically", () => {
    const sorted = sortLegacyProfiles([
      { ...base, wrestler: "Zulu", eliteCupWins: 1 },
      { ...base, wrestler: "Alpha", eliteCupWins: 1 },
      { ...base, wrestler: "Beta", longestWinStreakOverall: 0 },
      { ...base, wrestler: "Ace", globalChampionWins: 2, leagueWinsTotal: 2 },
    ]);
    expect(sorted.map((profile) => profile.legacyTier)).toEqual(["S", "A", "A", "D"]);
    expect(sorted.map((profile) => profile.wrestler)).toEqual(["Ace", "Alpha", "Zulu", "Beta"]);
    expect(sorted.every((profile) => /^[SABCD]$/.test(profile.legacyTier ?? ""))).toBe(true);
    expect(legacyTier({ ...base, globalChampionWins: 1 })).toBe("A");
  });
});
