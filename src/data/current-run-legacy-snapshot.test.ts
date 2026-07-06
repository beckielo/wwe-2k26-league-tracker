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
  getCurrentRunLegacySnapshot,
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

  it("restores the confirmed previous-split champion roles without styling normal names", () => {
    const audit = auditLegacyCompletedSplitSources([
      CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const roles = getPreviousSplitChampionColorRoles(audit);

    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Cody Rhodes", championRoles: roles })).toBe("normal");
  });

  it("keeps only champion colors that are consistent with the current post-split leagues", () => {
    const audit = auditLegacyCompletedSplitSources([
      CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const roles = keepCurrentRunConsistentChampionColorRoles(
      getPreviousSplitChampionColorRoles(audit),
      [
        { wrestler: "Gunther", league: "Global League" },
        { wrestler: "Randy Orton", league: "Global League" },
        { wrestler: "LA Knight", league: "National League" },
        { wrestler: "Dragon Lee", league: "Regional League" },
        { wrestler: "Roman Reigns", league: "Global League" },
        { wrestler: "Cody Rhodes", league: "Global League" },
      ],
    );

    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Missing Champion", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Cody Rhodes", championRoles: roles })).toBe("normal");
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
