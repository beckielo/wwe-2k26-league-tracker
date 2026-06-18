/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE } from "../legacy-manual-corrections";
import { aggregateEliteCupHistory, applyLegacyHistoryRecords, auditLegacyCompletedSplitSources, legacyProfileEliteCupRecords, summarizeLegacyProfiles } from "../legacy";
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

describe("Phase 10.10.7 Elite Cup event-slot canonicalization", () => {
  function canonicalState() {
    const seedProfiles = [{ ...base("Gunther"), eliteCupWins: 1 }, base("Roman Reigns"), base("Cody Rhodes"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])];
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: legacyProfileEliteCupRecords(seedProfiles) },
      { source: "Historical fallback", completedSplits: ["1:Historical Split"], eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "League Finals Elite Cup", wrestler: "Gunther", sourceLabel: "Historical fallback" }] },
      { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const profiles = applyLegacyHistoryRecords(seedProfiles, audit.leagueTitleRecords, audit.eliteCupRecords);
    return { audit, profiles, summary: summarizeLegacyProfiles(profiles, audit) };
  }

  it("canonicalizes duplicate Gunther candidate evidence into one historical event slot and derives all totals from slots only", () => {
    const { audit, profiles, summary } = canonicalState();
    const gunther = profiles.find((profile) => profile.wrestler === "Gunther")!;
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns")!;

    expect(audit.eliteCupCandidateAudit?.rawCandidateCount).toBe(3);
    expect(audit.eliteCupCandidateAudit?.canonicalEventSlotCount).toBe(2);
    expect(audit.eliteCupCandidateAudit?.slots.find((slot) => slot.wrestler === "Gunther")?.sourceLabels).toEqual(expect.arrayContaining(["Legacy_Tracker profile Elite Cup total", "Historical fallback"]));
    expect(gunther.eliteCupWins).toBe(1);
    expect(roman.eliteCupWins).toBe(1);
    expect(summary.eliteCupRecords).toBe(2);
    expect(summary.leagueTitleRecords).toBe(8);
  });

  it("does not add Legacy_Tracker aggregate Elite Cups on top of canonical event records for table or commentary", () => {
    const { profiles } = canonicalState();
    const gunther = profiles.find((profile) => profile.wrestler === "Gunther")!;
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns")!;

    expect(comparativeSignals(gunther, profiles).strongestEventNightCase).toBe(true);
    expect(comparativeSignals(roman, profiles).strongestEventNightCase).toBe(true);
    expect(generateLegacyCommentary(gunther, profiles).text).not.toMatch(/2 Elite Cup|two Elite Cup/i);
    expect(generateLegacyCommentary(roman, profiles).text).toMatch(/Elite Cup/i);

    render(<LegacyTable profiles={profiles} />);
    expect(screen.queryByText(/Legacy aggregation incomplete/i)).toBeNull();
    expect(screen.getByRole("row", { name: /Gunther/ }).textContent).toMatch(/Gunther/);
    expect(screen.getByRole("row", { name: /Roman Reigns/ }).textContent).toMatch(/Roman Reigns/);
  });

  it("flags conflicting winners in the same event slot internally without counting two Elite Cups", () => {
    const aggregation = aggregateEliteCupHistory([
      { leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Gunther", sourceLabel: "Legacy_Tracker profile Elite Cup total" },
      { leagueYear: 1, split: "Historical Split", eventName: "League Finals Elite Cup", wrestler: "Cody Rhodes", sourceLabel: "Historical fallback" },
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "User-confirmed manual historical correction" },
    ], ["1:Historical Split", "2:Opening Split"]);

    expect(aggregation.rawCandidateCount).toBe(3);
    expect(aggregation.canonicalEventSlotCount).toBe(1);
    expect(aggregation.winnerRecords).toEqual([expect.objectContaining({ wrestler: "Roman Reigns" })]);
    expect(aggregation.conflicts.join(" ")).toMatch(/conflicting winners/i);
  });
});
