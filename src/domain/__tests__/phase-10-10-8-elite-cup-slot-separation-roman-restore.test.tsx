/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE } from "../legacy-manual-corrections";
import { aggregateEliteCupHistory, applyLegacyHistoryRecords, auditLegacyCompletedSplitSources, canonicalEliteCupRecordKey, legacyProfileEliteCupRecords, summarizeLegacyProfiles } from "../legacy";
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

describe("Phase 10.10.8 Elite Cup slot separation and Roman restore", () => {
  function canonicalState() {
    const seedProfiles = [{ ...base("Gunther"), eliteCupWins: 1 }, base("Roman Reigns"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])];
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: legacyProfileEliteCupRecords(seedProfiles) },
      { source: "Legacy_Tracker aggregate fallback", completedSplits: ["1:Historical Split"], eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "Elite Cup", wrestler: "Gunther", sourceLabel: "Legacy_Tracker aggregate fallback" }] },
      { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const profiles = applyLegacyHistoryRecords(seedProfiles, audit.leagueTitleRecords, audit.eliteCupRecords);
    return { audit, profiles, summary: summarizeLegacyProfiles(profiles, audit) };
  }

  it("keeps Roman manual correction as a raw candidate and canonical LY2 Opening slot", () => {
    const { audit } = canonicalState();
    const rawRoman = audit.eliteCupCandidateAudit?.rawCandidates.find((record) => record.wrestler === "Roman Reigns");
    const romanSlot = audit.eliteCupCandidateAudit?.slots.find((slot) => slot.wrestler === "Roman Reigns");
    const guntherSlot = audit.eliteCupCandidateAudit?.slots.find((slot) => slot.wrestler === "Gunther");

    expect(rawRoman).toMatchObject({ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup" });
    expect(rawRoman?.sourceLabel).toMatch(/manual/i);
    expect(romanSlot).toMatchObject({ leagueYear: 2, split: "Opening Split", wrestler: "Roman Reigns" });
    expect(romanSlot?.sourceLabels.join(" ")).toMatch(/manual/i);
    expect(guntherSlot).toMatchObject({ leagueYear: 1, split: "Historical Split", wrestler: "Gunther" });
    expect(romanSlot?.slotKey).not.toBe(guntherSlot?.slotKey);
    expect(audit.eliteCupCandidateAudit?.canonicalEventSlotCount).toBe(2);
  });

  it("derives summary, table profiles, and commentary from the same two canonical slots", () => {
    const { audit, profiles, summary } = canonicalState();
    const gunther = profiles.find((profile) => profile.wrestler === "Gunther")!;
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns")!;

    expect(audit.eliteCupRecords).toHaveLength(2);
    expect(gunther.eliteCupWins).toBe(1);
    expect(roman.eliteCupWins).toBe(1);
    expect(summary.eliteCupRecords).toBe(2);
    expect(summary.leagueTitleRecords).toBe(8);
    expect(comparativeSignals(gunther, profiles).strongestEventNightCase).toBe(true);
    expect(comparativeSignals(roman, profiles).strongestEventNightCase).toBe(true);
    expect(generateLegacyCommentary(roman, profiles).text).toMatch(/Elite Cup/i);
    expect(generateLegacyCommentary(gunther, profiles).text).not.toMatch(/2 Elite Cup|two Elite Cup/i);

    render(<LegacyTable profiles={profiles} />);
    expect(screen.queryByText(/Elite Cup candidate|canonical Elite Cup/i)).toBeNull();
    expect(screen.getByRole("row", { name: /Roman Reigns/ }).textContent).toMatch(/Roman Reigns/);
  });

  it("does not use event type alone to merge historical Gunther and LY2 Opening Roman slots", () => {
    const historicalKey = canonicalEliteCupRecordKey({ leagueYear: 1, split: "Historical Split", eventName: "Elite Cup", wrestler: "Gunther" });
    const openingKey = canonicalEliteCupRecordKey({ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns" });
    const aggregation = aggregateEliteCupHistory([
      { leagueYear: 1, split: "Historical Split", eventName: "Elite Cup", wrestler: "Gunther", sourceLabel: "Legacy_Tracker aggregate fallback" },
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "User-confirmed manual correction" },
    ], ["1:Historical Split", "2:Opening Split"]);

    expect(historicalKey).not.toBe(openingKey);
    expect(aggregation.winnerRecords.map((record) => record.wrestler).sort()).toEqual(["Gunther", "Roman Reigns"]);
    expect(aggregation.canonicalEventSlotCount).toBe(2);
  });
});
