/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { applyManualEliteCupDisplayPatch, summarizeLegacyProfiles } from "../legacy";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";

const profile = (wrestler: string, eliteCupWins: number): LegacyProfile => ({
  wrestler,
  currentLeague: "Global League",
  goatStatusTier: null,
  leagueWinsTotal: wrestler === "Gunther" ? 8 : 0,
  globalChampionWins: wrestler === "Gunther" ? 1 : 0,
  eliteCupWins,
  doubles: 0,
  invincibleSplits: 0,
  invincibleHinrunden: 0,
  invincibleRueckrunden: 0,
  longestWinStreakOverall: 0,
  sourceCommentary: null,
});

afterEach(() => cleanup());

describe("Phase 10.10.8 manual Legacy Elite Cup display patch", () => {
  function patchedLegacyDisplay() {
    return applyManualEliteCupDisplayPatch([
      profile("Gunther", 2),
      profile("Roman Reigns", 0),
      profile("Cody Rhodes", 0),
    ], summarizeLegacyProfiles([
      profile("Gunther", 2),
      profile("Roman Reigns", 0),
      profile("Cody Rhodes", 0),
    ]));
  }

  it("forces the Legacy summary Elite Cup total to 2 while preserving 8 League Title Records", () => {
    const { summary } = patchedLegacyDisplay();

    expect(summary.eliteCupRecords).toBe(2);
    expect(summary.leagueTitleRecords).toBe(8);
  });

  it("sets only Gunther and Roman Reigns to one displayed Elite Cup", () => {
    const { profiles } = patchedLegacyDisplay();

    expect(profiles.find((entry) => entry.wrestler === "Gunther")?.eliteCupWins).toBe(1);
    expect(profiles.find((entry) => entry.wrestler === "Roman Reigns")?.eliteCupWins).toBe(1);
    expect(profiles.find((entry) => entry.wrestler === "Cody Rhodes")?.eliteCupWins).toBe(0);
  });

  it("feeds corrected values into Roman and Gunther commentary", () => {
    const { profiles } = patchedLegacyDisplay();
    const roman = profiles.find((entry) => entry.wrestler === "Roman Reigns")!;
    const gunther = profiles.find((entry) => entry.wrestler === "Gunther")!;
    const romanCommentary = generateLegacyCommentary(roman, profiles);
    const guntherCommentary = generateLegacyCommentary(gunther, profiles);

    expect(romanCommentary.evidenceTags).toContain("1 Elite Cup Win");
    expect(romanCommentary.text).not.toMatch(/no title or Elite Cup win|an Elite Cup win away|still records no .*Elite Cup|lacks an Elite Cup/i);
    expect(guntherCommentary.text).not.toMatch(/2 Elite Cup|2 recorded Elite Cup|two Elite Cup/i);
  });

  it("renders corrected Legacy rows without visible diagnostic UI", () => {
    const { profiles } = patchedLegacyDisplay();

    render(<LegacyTable profiles={profiles} />);

    expect(screen.getByRole("row", { name: /Gunther/ }).textContent).toMatch(/GuntherGlobal LeagueS81100000/);
    expect(screen.getByRole("row", { name: /Roman Reigns/ }).textContent).toMatch(/Roman ReignsGlobal League[A-D]0010000/);
    expect(document.querySelector(".legacy-diagnostics")).toBeNull();
    expect(screen.queryByText(/diagnostic|debug|Legacy aggregation incomplete/i)).toBeNull();
  });
});
