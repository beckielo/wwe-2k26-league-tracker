"use client";

import Link from "next/link";
import { detectActiveWeek, getWeekProgress } from "@/domain/week-progression";
import type { LeagueName, Match } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

export function DashboardWorkflowSummary({ matches, workbookCurrentWeek, userLeague }: { matches: Match[]; workbookCurrentWeek: number; userLeague: LeagueName }) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <div className="border border-white/10 bg-[#111722] p-6 text-sm text-slate-500">Loading weekly workflow…</div>;
  const resolution = detectActiveWeek(state, matches, workbookCurrentWeek);
  if (resolution.activeWeek === null) return <div className="border border-emerald-400/20 bg-emerald-400/5 p-6"><p className="font-black uppercase text-emerald-300">Season workflow complete</p><p className="mt-1 text-sm text-slate-400">No later authoritative scheduled week remains.</p></div>;

  const week = resolution.activeWeek;
  const progress = getWeekProgress(state, week, matches, userLeague);
  const userMatches = matches.filter((match) => match.week === week && match.league === userLeague);
  const userMatchIds = new Set(userMatches.map((match) => match.id));
  const userConfirmed = progress.confirmedResults.filter((result) => userMatchIds.has(result.matchId)).length;
  const nextUserShow = userMatches[0] ? `${userMatches[0].showDay} · ${userLeague}` : `${userLeague} card unavailable`;

  return <section className="border border-red-400/20 bg-gradient-to-r from-red-500/10 to-transparent p-6">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">Do this next</p><h2 className="mt-2 text-2xl font-black uppercase">Complete Week {week}</h2><p className="mt-2 text-sm text-slate-300">Next user show: {nextUserShow} · Week {week}</p><p className="mt-1 text-sm text-slate-500">User league {userConfirmed}/6 · Full week {progress.confirmed}/{progress.total} · {progress.missing} missing</p></div>
      <div className="flex flex-wrap gap-3"><Link href="/results" className="bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Enter user results</Link><Link href="/simulation" className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Simulate other leagues</Link><Link href="/week-review" className="border border-emerald-400/30 px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-300">Review & lock</Link></div>
    </div>
  </section>;
}
