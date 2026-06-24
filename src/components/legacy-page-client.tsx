"use client";

import { useMemo } from "react";
import { applyCompletedSplitLegacyCommits, summarizeLegacyProfiles, type LegacySummary } from "@/domain/legacy";
import type { LegacyProfile } from "@/domain/legacy-commentary";
import { useTrackerState } from "@/state/tracker-state-provider";
import { LegacyTable } from "./legacy-table";
import { getLastCompletedSplitChampionMetadata } from "@/domain/previous-split-name-colors";
import { Stat } from "./ui";

export function LegacyPageClient({ profiles, summary: workbookSummary }: { profiles: LegacyProfile[]; summary: LegacySummary }) {
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
    <div className="legacy-stats">
      <Stat label="Ranked profiles" value={summary.rankedProfiles} detail="All populated workbook rows" />
      <Stat label="Active tiers" value={summary.activeLegacyTiers} detail="S-D tier values currently used" />
      <Stat label="League title records" value={summary.leagueTitleRecords} detail={committedCount ? "Workbook + browser-local completed split commits" : "Recorded historical title total"} />
      <Stat label="Elite Cup records" value={summary.eliteCupRecords} detail={committedCount ? "Workbook + browser-local completed split commits" : "Recorded historical event total"} />
    </div>
    {committedCount > 0 && <p className="legacy-policy">Latest completed split included: {latestCompleted?.split ?? "completed split"}. {activeSplitLine}. Legacy includes workbook base records plus local completed split overlay. Source: Legacy_Tracker plus {committedCount} browser-local completed split commit{committedCount === 1 ? "" : "s"}. Completed split facts are merged exactly once by source signature.</p>}
    <LegacyTable profiles={mergedProfiles} />
  </>;
}
