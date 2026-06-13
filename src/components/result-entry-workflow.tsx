"use client";

import Link from "next/link";
import { ResultEntryForm } from "./result-entry-form";
import { Panel, Stat } from "./ui";
import { detectActiveWeek, getActiveUserLeagueMatches, getWeekProgress } from "@/domain/week-progression";
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

  const resolution = detectActiveWeek(state, matches, workbookCurrentWeek);
  if (resolution.activeWeek === null) {
    return <div className="border border-emerald-400/20 bg-emerald-400/5 p-10 text-center"><h2 className="text-2xl font-black uppercase">Season workflow complete</h2><p className="mt-2 text-slate-400">No later authoritative scheduled week remains.</p></div>;
  }

  const week = resolution.activeWeek;
  const userMatches = getActiveUserLeagueMatches(state, matches, workbookCurrentWeek, userLeague);
  const progress = getWeekProgress(state, week, matches, userLeague);
  const confirmedIds = new Set(progress.confirmedResults.map((result) => result.matchId));
  const userConfirmed = userMatches.filter((match) => confirmedIds.has(match.id)).length;
  const userMissing = userMatches.length - userConfirmed;

  return <>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Active app week" value={`Week ${week}`} detail="Workbook baseline + local locks" />
      <Stat label="User show progress" value={`${userConfirmed}/${userMatches.length}`} detail={`${userMissing} ${userMissing === 1 ? "match" : "matches"} still required`} />
      <Stat label="Controlled league" value={userLeague.replace(" League", "")} detail={userWrestler} />
    </div>

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
          <Link href="/week-review" className="inline-block bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Open Week Review →</Link>
        </div>
      </Panel>
    </div>
  </>;
}
