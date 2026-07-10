import { describe, expect, it } from "vitest";
import { excludeBaselineLegacyCommits } from "@/components/legacy-page-client";
import { auditLegacyCompletedSplitSources } from "@/domain/legacy";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE } from "@/domain/legacy-manual-corrections";
import { getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole, keepCurrentRunConsistentChampionColorRoles } from "@/domain/previous-split-name-colors";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";
import {
  CURRENT_RUN_COMPLETED_SPLIT_COMMIT,
  CURRENT_RUN_COMPLETED_SPLIT_KEY,
  CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
  CURRENT_RUN_LEGACY_SOURCE_FILE,
  CURRENT_RUN_PREVIOUS_SPLIT_WINNERS,
  getCurrentRunLegacySnapshot,
  getCurrentRunPreviousSplitChampionColorRoles,
} from "./current-run-legacy-snapshot";

describe("current-run Legacy display snapshot", () => {
  it("is scoped only to the authoritative LY2 Closing W36 baseline", () => {
    expect(getCurrentRunLegacySnapshot({
      sourceFile: CURRENT_RUN_LEGACY_SOURCE_FILE,
      leagueYear: 2,
      split: "Closing Split",
    })).not.toBeNull();

    expect(getCurrentRunLegacySnapshot({
      sourceFile: CURRENT_RUN_LEGACY_SOURCE_FILE,
      leagueYear: 3,
      split: "Opening Split",
    })).toBeNull();
    expect(getCurrentRunLegacySnapshot({
      sourceFile: "future-master.xlsx",
      leagueYear: 2,
      split: "Closing Split",
    })).toBeNull();
  });

  it("uses the reconciled current-run source for every previous-split winner role", () => {
    const audit = auditLegacyCompletedSplitSources([
      CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const roles = getPreviousSplitChampionColorRoles(audit);

    expect(CURRENT_RUN_PREVIOUS_SPLIT_WINNERS).toEqual({
      "Global League": "Gunther",
      "Continental League": "Randy Orton",
      "National League": "Undertaker",
      "Regional League": "Pete Dunne",
    });
    expect(CURRENT_RUN_COMPLETED_SPLIT_COMMIT.titleRecords).toEqual([
      { league: "Global League", wrestler: "Gunther" },
      { league: "Continental League", wrestler: "Randy Orton" },
      { league: "National League", wrestler: "Undertaker" },
      { league: "Regional League", wrestler: "Pete Dunne" },
    ]);
    expect(CURRENT_RUN_COMPLETED_SPLIT_SOURCE.source).toContain("user-confirmed National/Regional corrections");
    expect(CURRENT_RUN_COMPLETED_SPLIT_SOURCE.notes).toContainEqual(expect.stringContaining("merged PR #109"));
    expect(CURRENT_RUN_COMPLETED_SPLIT_SOURCE.notes).toContainEqual(expect.stringContaining("commit 0f5833e"));
    expect(CURRENT_RUN_COMPLETED_SPLIT_SOURCE.notes).toContainEqual(expect.stringContaining("later confirmed Undertaker and Pete Dunne corrections"));
    expect(CURRENT_RUN_COMPLETED_SPLIT_SOURCE.notes).toContainEqual(expect.stringContaining("superseded LA Knight and Dragon Lee"));
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Undertaker", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Pete Dunne", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Cody Rhodes", championRoles: roles })).toBe("normal");
  });

  it("keeps valid promotion-path colors and rejects unsupported previous false positives", () => {
    const audit = auditLegacyCompletedSplitSources([
      CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const currentComposition: Parameters<typeof keepCurrentRunConsistentChampionColorRoles>[1] = [
        { wrestler: "Gunther", league: "Global League" },
        { wrestler: "Randy Orton", league: "Global League" },
        { wrestler: "Undertaker", league: "Continental League" },
        { wrestler: "Pete Dunne", league: "National League" },
        { wrestler: "LA Knight", league: "National League" },
        { wrestler: "Dragon Lee", league: "Regional League" },
        { wrestler: "Roman Reigns", league: "Global League" },
        { wrestler: "Cody Rhodes", league: "Global League" },
      ];
    const sourceRoles = getPreviousSplitChampionColorRoles(audit);
    const staleRoles = new Map(sourceRoles);
    staleRoles.set("la knight", "national-champion");
    staleRoles.set("dragon lee", "regional-champion");
    const roles = keepCurrentRunConsistentChampionColorRoles(staleRoles, currentComposition);

    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Undertaker", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Pete Dunne", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Missing Champion", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Cody Rhodes", championRoles: roles })).toBe("normal");

    const currentLeagueOnly = keepCurrentRunConsistentChampionColorRoles(new Map(), currentComposition);
    expect(getPreviousSplitNameColorRole({ wrestler: "Undertaker", championRoles: currentLeagueOnly })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Pete Dunne", championRoles: currentLeagueOnly })).toBe("normal");
  });

  it("ignores a stale browser-local commit for the audited baseline split but keeps a newer split", () => {
    const audit = auditLegacyCompletedSplitSources([
      CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const staleOpeningCommit: CompletedSplitLegacyCommit = {
      ...CURRENT_RUN_COMPLETED_SPLIT_COMMIT,
      sourceSignature: "stale-browser-local-opening",
      titleRecords: [
        { league: "Global League", wrestler: "Gunther" },
        { league: "Continental League", wrestler: "Randy Orton" },
        { league: "National League", wrestler: "LA Knight" },
        { league: "Regional League", wrestler: "Dragon Lee" },
      ],
    };
    const correctedRoles = getCurrentRunPreviousSplitChampionColorRoles(audit, [staleOpeningCommit]);

    expect(getPreviousSplitNameColorRole({ wrestler: "Undertaker", championRoles: correctedRoles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Pete Dunne", championRoles: correctedRoles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: correctedRoles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: correctedRoles })).toBe("normal");

    const futureClosingCommit: CompletedSplitLegacyCommit = {
      ...CURRENT_RUN_COMPLETED_SPLIT_COMMIT,
      sourceSignature: "future-browser-local-closing",
      leagueYear: 2,
      split: "Closing Split",
      titleRecords: [
        { league: "Global League", wrestler: "Future Global" },
        { league: "Continental League", wrestler: "Future Continental" },
        { league: "National League", wrestler: "Future National" },
        { league: "Regional League", wrestler: "Future Regional" },
      ],
      eliteCupWinner: "Future Cup",
    };
    const futureRoles = getCurrentRunPreviousSplitChampionColorRoles(audit, [staleOpeningCommit, futureClosingCommit]);

    expect(getPreviousSplitNameColorRole({ wrestler: "Future National", championRoles: futureRoles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Undertaker", championRoles: futureRoles })).toBe("normal");
  });

  it("does not count the same split twice when browser-local metadata still contains it", () => {
    const futureCommit: CompletedSplitLegacyCommit = {
      ...CURRENT_RUN_COMPLETED_SPLIT_COMMIT,
      sourceSignature: "future-closing",
      leagueYear: 2,
      split: "Closing Split",
    };

    expect(excludeBaselineLegacyCommits(
      [CURRENT_RUN_COMPLETED_SPLIT_COMMIT, futureCommit],
      [CURRENT_RUN_COMPLETED_SPLIT_KEY],
    )).toEqual([futureCommit]);
  });
});
