import type { LegacyCompletedSplitAudit, LegacyCompletedSplitSource } from "@/domain/legacy";
import { getPreviousSplitChampionColorRoles } from "@/domain/previous-split-name-colors";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type SplitName } from "@/domain/types";

export const CURRENT_RUN_LEGACY_SOURCE_FILE =
  "[source-docs-current-master] WWE_2K26_Liga_System_LY2_Closing_W36_abgeschlossen.xlsx";

export const CURRENT_RUN_COMPLETED_SPLIT_KEY = "2:Opening Split";

const sourceLabel =
  "Reconciled LY2 Opening completed-split winner snapshot (user-confirmed National/Regional corrections)";

export const CURRENT_RUN_PREVIOUS_SPLIT_WINNERS = {
  "Global League": "Gunther",
  "Continental League": "Randy Orton",
  "National League": "Undertaker",
  "Regional League": "Pete Dunne",
} as const satisfies Record<LeagueName, string>;

export const CURRENT_RUN_COMPLETED_SPLIT_COMMIT: CompletedSplitLegacyCommit = {
  sourceSignature: "current-run:ly2:opening:reconciled-winners-v2",
  committedAt: "2026-06-24T01:43:37+02:00",
  leagueYear: 2,
  split: "Opening Split",
  titleRecords: LEAGUE_NAMES.map((league) => ({
    league,
    wrestler: CURRENT_RUN_PREVIOUS_SPLIT_WINNERS[league],
  })),
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
    "Run-specific LY2 Opening winner snapshot used only for the current-run Legacy display and previous-split name colors.",
    "Global and Continental retain the accepted corrected final-standings placements versioned in merged PR #109 (commit 0f5833e); National and Regional use the user's later confirmed Undertaker and Pete Dunne corrections.",
    "The separate Roman Reigns Elite Cup record remains backed by the existing user-confirmed manual historical correction.",
    "The earlier Phase 19 fixture is not treated as blanket authority: its superseded LA Knight and Dragon Lee National/Regional metadata is excluded from this reconciled source.",
    "National and Regional winner roles are not inferred from current league membership; the current composition is used only to reject contradictory display roles.",
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

export function getCurrentRunPreviousSplitChampionColorRoles(
  audit: LegacyCompletedSplitAudit | undefined,
  commits: CompletedSplitLegacyCommit[] = [],
) {
  const hasCurrentRunBaseline = audit?.sources.some((source) => source.source === sourceLabel) ?? false;
  const nonBaselineCommits = hasCurrentRunBaseline
    ? commits.filter((commit) => (
        commit.leagueYear !== CURRENT_RUN_COMPLETED_SPLIT_COMMIT.leagueYear
        || commit.split !== CURRENT_RUN_COMPLETED_SPLIT_COMMIT.split
      ))
    : commits;
  return getPreviousSplitChampionColorRoles(audit, nonBaselineCommits);
}
