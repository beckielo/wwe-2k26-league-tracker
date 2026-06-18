/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE } from "../legacy-manual-corrections";
import { aggregateEliteCupHistory, applyLegacyHistoryRecords, auditLegacyCompletedSplitSources, inspectCanonicalEliteCupRecordDuplicates, legacyProfileEliteCupRecords, summarizeLegacyProfiles } from "../legacy";
import { comparativeSignals, generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import { LEAGUE_NAMES } from "../types";

const base = (wrestler: string): LegacyProfile => ({
  wrestler,
  currentLeague: "Global League",
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
});

const titles = (leagueYear: number, split: string) => LEAGUE_NAMES.map((league) => ({ leagueYear, split, league, wrestler: `${league} ${leagueYear}` }));

afterEach(() => cleanup());

function correctedProfiles() {
  const seedProfiles = [{ ...base("Gunther"), eliteCupWins: 2 }, base("Roman Reigns"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])];
  const legacyRecords = legacyProfileEliteCupRecords(seedProfiles);
  const audit = auditLegacyCompletedSplitSources([
    { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: legacyRecords },
    { source: "Fallback/history", completedSplits: ["1:Historical Split"], eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "League Finals Elite Cup", wrestler: "Gunther", sourceLabel: "Fallback history" }] },
    { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
    MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
  ]);
  const profiles = applyLegacyHistoryRecords(seedProfiles, audit.leagueTitleRecords, audit.eliteCupRecords);
  return { audit, profiles, summary: summarizeLegacyProfiles(profiles, audit), legacyRecords };
}

describe("Phase 10.10.6 Elite Cup deduplication correction", () => {
  it("keeps the current canonical Elite Cup record list to Gunther once and Roman once", () => {
    const { audit, profiles, summary } = correctedProfiles();

    expect(audit.eliteCupRecords.map((record) => `${record.wrestler}:${record.leagueYear}:${record.split}`).sort()).toEqual([
      "Gunther:1:Historical Split",
      "Roman Reigns:2:Opening Split",
    ]);
    expect(summary.eliteCupRecords).toBe(2);
    expect(summary.leagueTitleRecords).toBe(8);
    expect(profiles.find((profile) => profile.wrestler === "Gunther")?.eliteCupWins).toBe(1);
    expect(profiles.find((profile) => profile.wrestler === "Roman Reigns")?.eliteCupWins).toBe(1);
  });

  it("exposes duplicate canonical Elite Cup sources for tests without rendering visible diagnostics by default", () => {
    const { audit, legacyRecords, profiles } = correctedProfiles();
    const diagnostics = inspectCanonicalEliteCupRecordDuplicates([
      ...legacyRecords,
      { leagueYear: 1, split: "Historical Split", eventName: "Global League Elite Cup", wrestler: " Gunther ", sourceLabel: "Fallback history" },
      { leagueYear: 2, split: "Opening Split", eventName: "Elite Cup", wrestler: "Roman Reigns", sourceLabel: "League Finals records" },
      ...MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE.eliteCupRecords!,
    ]);

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalRecord: expect.objectContaining({ wrestler: "Gunther" }), duplicateCount: 3 }),
      expect.objectContaining({ canonicalRecord: expect.objectContaining({ wrestler: "Roman Reigns" }), duplicateCount: 2 }),
    ]));

    render(<LegacyTable profiles={profiles} />);
    expect(screen.queryByText(/Fallback history/)).toBeNull();
    expect(screen.queryByText(/Legacy aggregation incomplete/i)).toBeNull();
    expect(audit.duplicateRecordsRemoved).toBeGreaterThan(0);
  });

  it("uses corrected canonical profile values in Gunther, Roman, and comparative commentary", () => {
    const { profiles } = correctedProfiles();
    const gunther = profiles.find((profile) => profile.wrestler === "Gunther")!;
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns")!;

    expect(generateLegacyCommentary(gunther, profiles).text).not.toMatch(/2 Elite Cup|2 recorded Elite Cup|two Elite Cup/i);
    expect(generateLegacyCommentary(gunther, profiles).text).toMatch(/1 Elite Cup|1 recorded Elite Cup|recording 1 victory/i);
    expect(generateLegacyCommentary(roman, profiles).text).toMatch(/1 Elite Cup|1 recorded Elite Cup|recording 1 victory/i);
    expect(comparativeSignals(gunther, profiles).strongestEventNightCase).toBe(true);
    expect(comparativeSignals(roman, profiles).strongestEventNightCase).toBe(true);

    render(<LegacyTable profiles={profiles} />);
    expect(screen.getByRole("row", { name: /Gunther/ }).textContent).toMatch(/Gunther/);
    expect(screen.getByRole("row", { name: /Roman Reigns/ }).textContent).toMatch(/Roman Reigns/);
  });

  it("deduplicates automatic and manual Roman records while preserving the manual correction when it is the only source", () => {
    expect(aggregateEliteCupHistory(MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE.eliteCupRecords!, ["2:Opening Split"]).winnerRecords).toEqual([
      expect.objectContaining({ wrestler: "Roman Reigns", sourceLabel: expect.stringMatching(/manual/i) }),
    ]);
    expect(aggregateEliteCupHistory([
      { leagueYear: 2, split: "Opening Split", eventName: "League Finals Elite Cup", wrestler: "Roman Reigns", sourceLabel: "League Finals records" },
      ...MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE.eliteCupRecords!,
    ], ["2:Opening Split"]).winnerRecords).toEqual([
      expect.objectContaining({ wrestler: "Roman Reigns", sourceLabel: "League Finals records" }),
    ]);
  });
});
