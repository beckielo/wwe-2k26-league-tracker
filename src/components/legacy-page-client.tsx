"use client";

import { useMemo } from "react";
import { applyCompletedSplitLegacyCommits, summarizeLegacyProfiles, type LegacySummary } from "@/domain/legacy";
import type { LegacyProfile } from "@/domain/legacy-commentary";
import { useTrackerState } from "@/state/tracker-state-provider";
import { LegacyTable } from "./legacy-table";
import { getLastCompletedSplitChampionMetadata } from "@/domain/previous-split-name-colors";
import { Stat } from "./ui";
import type { HistoricalAnalyticsAudit } from "@/domain/historical-analytics";

export function LegacyPageClient({
  profiles,
  summary: workbookSummary,
  historicalAnalytics,
}: {
  profiles: LegacyProfile[];
  summary: LegacySummary;
  historicalAnalytics: HistoricalAnalyticsAudit;
}) {
  const { state, hydrated } = useTrackerState();
  const mergedProfiles = useMemo(
    () => hydrated ? applyCompletedSplitLegacyCommits(profiles, state.completedSplitLegacyCommits) : profiles,
    [hydrated, profiles, state.completedSplitLegacyCommits],
  );
  const summary = useMemo(() => summarizeLegacyProfiles(mergedProfiles, workbookSummary.audit), [mergedProfiles, workbookSummary.audit]);
  const committedCount = hydrated ? new Set((state.completedSplitLegacyCommits ?? []).map((commit) => commit.sourceSignature)).size : 0;
  const latestCompleted = hydrated ? getLastCompletedSplitChampionMetadata(state.completedSplitLegacyCommits) : null;
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
