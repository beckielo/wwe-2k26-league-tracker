"use client";

import { useMemo } from "react";
import { applyCompletedSplitLegacyCommits, summarizeLegacyProfiles, type LegacySummary } from "@/domain/legacy";
import type { LegacyProfile } from "@/domain/legacy-commentary";
import { useTrackerState } from "@/state/tracker-state-provider";
import { LegacyTable } from "./legacy-table";
import { getLastCompletedSplitChampionMetadata } from "@/domain/previous-split-name-colors";
import { Stat } from "./ui";
import type { HistoricalAnalyticsAudit } from "@/domain/historical-analytics";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";

function completedSplitKey(commit: Pick<CompletedSplitLegacyCommit, "leagueYear" | "split">): string {
  return `${commit.leagueYear}:${commit.split}`;
}

export function excludeBaselineLegacyCommits(
  commits: CompletedSplitLegacyCommit[] = [],
  baselineCompletedSplitKeys: string[] = [],
): CompletedSplitLegacyCommit[] {
  const included = new Set(baselineCompletedSplitKeys);
  return commits.filter((commit) => !included.has(completedSplitKey(commit)));
}

export function LegacyPageClient({
  profiles,
  summary: workbookSummary,
  historicalAnalytics,
  baselineCompletedSplitKeys,
}: {
  profiles: LegacyProfile[];
  summary: LegacySummary;
  historicalAnalytics: HistoricalAnalyticsAudit;
  baselineCompletedSplitKeys: string[];
}) {
  const { state, hydrated } = useTrackerState();
  const localOnlyCommits = useMemo(
    () => excludeBaselineLegacyCommits(state.completedSplitLegacyCommits, baselineCompletedSplitKeys),
    [baselineCompletedSplitKeys, state.completedSplitLegacyCommits],
  );
  const mergedProfiles = useMemo(
    () => hydrated ? applyCompletedSplitLegacyCommits(profiles, localOnlyCommits) : profiles,
    [hydrated, localOnlyCommits, profiles],
  );
  const summary = useMemo(() => summarizeLegacyProfiles(mergedProfiles, workbookSummary.audit), [mergedProfiles, workbookSummary.audit]);
  const committedCount = hydrated ? new Set(localOnlyCommits.map((commit) => commit.sourceSignature)).size : 0;
  const latestCompleted = hydrated ? getLastCompletedSplitChampionMetadata(localOnlyCommits) : null;
  const activeSplitLine = hydrated && state.activeWorkflow ? `Active split: ${state.activeWorkflow.split} Week ${state.activeWorkflow.splitWeek}` : null;

  return <>
    <p className="legacy-policy">All-time honours remain preserved. Current league placement and longest-streak updates use completed League Year {historicalAnalytics.leagueYear} {historicalAnalytics.split} results through Split Week {historicalAnalytics.completedThroughSplitWeek}; the active incomplete split does not create title or cup records.</p>
    <div className="legacy-stats">
      <Stat label="Ranked profiles" value={summary.rankedProfiles} detail="All recorded profiles" />
      <Stat label="Active tiers" value={summary.activeLegacyTiers} detail="S-D tier values currently used" />
      <Stat label="League title records" value={summary.leagueTitleRecords} detail={committedCount ? "Recorded history + completed split updates" : "Recorded historical title total"} />
      <Stat label="Elite Cup records" value={summary.eliteCupRecords} detail={committedCount ? "Recorded history + completed split updates" : "Recorded historical event total"} />
    </div>
    {committedCount > 0 && <p className="legacy-policy">Latest completed split included: {latestCompleted?.split ?? "completed split"}. {activeSplitLine}. {committedCount} completed split update{committedCount === 1 ? " is" : "s are"} included once in the all-time totals.</p>}
    <LegacyTable profiles={mergedProfiles} />
  </>;
}
