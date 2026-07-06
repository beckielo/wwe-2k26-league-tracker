import type { LegacyCompletedSplitSource } from "@/domain/legacy";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";
import type { SplitName } from "@/domain/types";

export const CURRENT_RUN_LEGACY_SOURCE_FILE =
  "[source-docs-current-master] WWE_2K26_Liga_System_LY2_Closing_W36_abgeschlossen.xlsx";

export const CURRENT_RUN_COMPLETED_SPLIT_KEY = "2:Opening Split";

const sourceLabel =
  "Versioned LY2 Opening completed-split snapshot (Git commit 031d361)";

export const CURRENT_RUN_COMPLETED_SPLIT_COMMIT: CompletedSplitLegacyCommit = {
  sourceSignature: "current-run:ly2:opening:031d361",
  committedAt: "2026-06-24T01:43:37+02:00",
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

export const CURRENT_RUN_COMPLETED_SPLIT_SOURCE: LegacyCompletedSplitSource = {
  source: sourceLabel,
  completedSplits: [CURRENT_RUN_COMPLETED_SPLIT_KEY],
  titleRecords: CURRENT_RUN_COMPLETED_SPLIT_COMMIT.titleRecords.map((record) => ({
    leagueYear: CURRENT_RUN_COMPLETED_SPLIT_COMMIT.leagueYear,
    split: CURRENT_RUN_COMPLETED_SPLIT_COMMIT.split,
    league: record.league as "Global League" | "Continental League" | "National League" | "Regional League",
    wrestler: record.wrestler,
    sourceLabel,
  })),
  eliteCupRecords: [{
    leagueYear: 2,
    split: "Opening Split",
    eventName: "Global Elite Cup",
    wrestler: "Roman Reigns",
    sourceLabel,
  }],
  notes: [
    "Run-specific display snapshot recovered from the previously tested completed-split metadata.",
    "The four champions and Elite Cup result match the Phase 19Z current-run fixture committed in 031d361.",
    "This snapshot does not mutate the Phase 1 completed-split archive or infer missing archive fields.",
  ],
};

export function getCurrentRunLegacySnapshot(input: {
  sourceFile: string;
  leagueYear: number;
  split: SplitName;
}) {
  if (
    input.sourceFile !== CURRENT_RUN_LEGACY_SOURCE_FILE
    || input.leagueYear !== 2
    || input.split !== "Closing Split"
  ) {
    return null;
  }

  return {
    completedSplitKey: CURRENT_RUN_COMPLETED_SPLIT_KEY,
    commit: CURRENT_RUN_COMPLETED_SPLIT_COMMIT,
    source: CURRENT_RUN_COMPLETED_SPLIT_SOURCE,
  };
}
