"use client";

import { useTrackerState } from "@/state/tracker-state-provider";
import type { LegacyFact } from "@/domain/post-finals-transition";

export function HistoryDashboard({ leagueYear, split, facts }: { leagueYear: number; split: string; facts: LegacyFact[] }) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <p className="text-slate-400">Loading history facts…</p>;
  const hasCompletedFinals = (state.completedFinalsNights ?? []).length === 2;
  const visibleFacts = hasCompletedFinals ? facts : [];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="border border-white/10 bg-white/[.025] p-5"><span className="text-xs uppercase text-slate-500">League year</span><strong className="mt-2 block text-2xl">{leagueYear}</strong></div>
      <div className="border border-white/10 bg-white/[.025] p-5"><span className="text-xs uppercase text-slate-500">Split</span><strong className="mt-2 block text-2xl">{split}</strong></div>
      <div className="border border-white/10 bg-white/[.025] p-5"><span className="text-xs uppercase text-slate-500">Record type</span><strong className="mt-2 block text-2xl">Facts only</strong></div>
    </div>
    {visibleFacts.length === 0 ? <div className="border border-white/10 p-8 text-slate-300">History facts will populate as splits and League Finals are completed.</div> :
      <div className="grid gap-4 md:grid-cols-2">{visibleFacts.map((fact, index) => <article key={`${fact.label}-${fact.wrestler}-${index}`} className="border border-white/10 bg-[#111722] p-5">
        <p className="text-xs font-black uppercase tracking-wider text-red-400">{fact.label}</p>
        <h2 className="mt-2 text-xl font-black">{fact.wrestler}</h2>
        <p className="mt-2 text-sm text-slate-400">{fact.detail}</p>
      </article>)}</div>}
    <p className="border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">No GOAT score, prestige formula, power ranking, or subjective legacy ranking is calculated.</p>
  </div>;
}
