"use client";

import { useTrackerState } from "@/state/tracker-state-provider";
import type { LegacyFact } from "@/domain/post-finals-transition";
import { EmptyState, Stat, StatusBadge } from "./ui";

export function HistoryDashboard({ leagueYear, split, facts }: { leagueYear: number; split: string; facts: LegacyFact[] }) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <p className="text-slate-400">Loading history facts…</p>;
  const hasCompletedFinals = (state.completedFinalsNights ?? []).length === 2;
  const visibleFacts = hasCompletedFinals ? facts : [];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="League year" value={leagueYear} detail="WWE 2K26 calendar" />
      <Stat label="Active split" value={split} detail="Champions tracked by split" />
      <Stat label="Record policy" value="Facts only" detail="No subjective GOAT score" />
    </div>
    {visibleFacts.length === 0 ? <EmptyState title="No finalized records yet" description="Champions, Elite Cup winners, movement, and Beckielo status appear here only after the relevant split and finals facts are completed." /> :
      <div className="grid gap-4 md:grid-cols-2">{visibleFacts.map((fact, index) => <article key={`${fact.label}-${fact.wrestler}-${index}`} className="border border-white/10 bg-[#111722] p-5">
        <StatusBadge tone="completed">{fact.label}</StatusBadge>
        <h2 className="mt-2 text-xl font-black">{fact.wrestler}</h2>
        <p className="mt-2 text-sm text-slate-400">{fact.detail}</p>
      </article>)}</div>}
    <p className="border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">No GOAT score, prestige formula, power ranking, or subjective legacy ranking is calculated.</p>
  </div>;
}
