"use client";

import Link from "next/link";
import { ResultEntryForm } from "./result-entry-form";
import { Panel, Stat } from "./ui";
import { WorkflowSummaryBanner } from "./workflow-summary-banner";
import { getActiveUserLeagueMatches, getWorkflowSummary } from "@/domain/week-progression";
import type { LeagueName, Match } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface ResultEntryWorkflowProps {
  matches: Match[];
  workbookCurrentWeek: number;
  userLeague: LeagueName;
  userWrestler: string;
}

export function ResultEntryWorkflow({ matches, workbookCurrentWeek, userLeague, userWrestler }: ResultEntryWorkflowProps) {
  const { state, hydrated } = useTrackerState();

  if (!hydrated) return <div className="border border-white/10 p-6 text-sm text-slate-500">Loading local tracker state…</div>;

  const summary = getWorkflowSummary(state, matches, workbookCurrentWeek, userLeague);
  const week = summary.activeWeek;
  if (week === null) return <WorkflowSummaryBanner matches={matches} workbookCurrentWeek={workbookCurrentWeek} userLeague={userLeague} />;
  const userMatches = getActiveUserLeagueMatches(state, matches, workbookCurrentWeek, userLeague);
  const userConfirmed = summary.userLeagueProgress?.confirmed ?? 0;
  const userMissing = summary.userLeagueProgress?.missing ?? userMatches.length;
  const userShowComplete = userMissing === 0;

  return <>
    <div className="mb-8">
      <WorkflowSummaryBanner matches={matches} workbookCurrentWeek={workbookCurrentWeek} userLeague={userLeague} compact />
    </div>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Active app week" value={`Week ${week}`} detail="Workbook baseline + local locks" />
      <Stat label="User show progress" value={`${userConfirmed}/${userMatches.length}`} detail={userShowComplete ? "User show complete" : `${userMissing} ${userMissing === 1 ? "match" : "matches"} still required`} />
      <Stat label="Controlled league" value={userLeague.replace(" League", "")} detail={userWrestler} />
    </div>

    {userShowComplete && (
      <div className="mb-6 flex flex-col justify-between gap-4 border border-emerald-400/25 bg-emerald-400/10 p-5 sm:flex-row sm:items-center">
        <div><p className="font-black uppercase text-emerald-200">Week {week} user show complete</p><p className="mt-1 text-sm text-slate-300">All {userMatches.length} {userLeague} results are confirmed. Existing results remain editable until the week is locked.</p></div>
        <Link href={summary.recommendedHref} className="bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">{summary.recommendedLabel} →</Link>
      </div>
    )}

    <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <Panel>
        <div className="border-b border-white/10 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">Week {week} · next required user show</p><h2 className="mt-2 text-2xl font-black uppercase">{userLeague} result entry</h2></div>
        {userMatches.length > 0 ? <ResultEntryForm matches={userMatches} userLeague={userLeague} /> : <div className="p-6 text-slate-400">No authoritative user-league matches exist for this week.</div>}
      </Panel>
      <Panel className="h-fit">
        <div className="border-b border-white/10 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">Weekly workflow</p><h2 className="mt-2 text-2xl font-black uppercase">What happens next</h2></div>
        <div className="space-y-4 p-6 text-sm leading-6 text-slate-300">
          <p>Only the six authoritative {userLeague} matchups for active Week {week} are available here.</p>
          <p>Confirmed results remain editable until Week {week} is completed and locked in Week Review.</p>
          <p>The workbook stays read-only; confirmations are stored only in this browser.</p>
          <Link href={summary.recommendedHref} className="inline-block bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">{summary.recommendedLabel} →</Link>
        </div>
      </Panel>
    </div>
  </>;
}
