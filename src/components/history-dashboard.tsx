"use client";

import { useTrackerState } from "@/state/tracker-state-provider";
import type { LegacyFact } from "@/domain/post-finals-transition";
import type { CompletedSplitHistoryRecord } from "@/domain/completed-split-history";
import { EmptyState, Stat, StatusBadge } from "./ui";

export function HistoryDashboard({ leagueYear, split, facts, completedSplits }: { leagueYear: number; split: string; facts: LegacyFact[]; completedSplits: CompletedSplitHistoryRecord[] }) {
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
    {visibleFacts.length === 0 && completedSplits.length === 0 ? <EmptyState title="No finalized records yet" description="Champions, Elite Cup winners, movement, and Beckielo status appear here only after the relevant split and finals facts are completed." /> :
      visibleFacts.length > 0 ?
      <div className="grid gap-4 md:grid-cols-2">{visibleFacts.map((fact, index) => <article key={`${fact.label}-${fact.wrestler}-${index}`} className="border border-white/10 bg-[#111722] p-5">
        <StatusBadge tone="completed">{fact.label}</StatusBadge>
        <h2 className="mt-2 text-xl font-black">{fact.wrestler}</h2>
        <p className="mt-2 text-sm text-slate-400">{fact.detail}</p>
      </article>)}</div> : null}
    <section className="border border-white/10 bg-[#111722] p-6" aria-labelledby="completed-split-history-title">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-red-300">Permanent archive readiness</p>
        <h2 id="completed-split-history-title" className="mt-2 text-2xl font-black uppercase">Completed Split History</h2>
      </div>
      {completedSplits.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="No completed split archived" description="A split appears here only after completion is confirmed." />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {completedSplits.map((record) => (
            <article key={record.id} className="border border-white/10 bg-black/15 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">League Year {record.leagueYear}</p>
                  <h3 className="mt-1 text-xl font-black">{record.split}</h3>
                </div>
                <StatusBadge tone="completed">Completed</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-xs font-bold uppercase text-amber-200">League champions</p>
                  <strong className="mt-1 block">
                    {record.leagueChampions.status === "confirmed"
                      ? `${record.leagueChampions.data.length} confirmed`
                      : "Not archived"}
                  </strong>
                  {record.leagueChampions.status !== "confirmed" && (
                    <p className="mt-2 text-sm text-slate-300">This split is complete, but its league champions were not archived.</p>
                  )}
                </div>
                <div className="border border-white/10 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">Global Elite Cup</p>
                  <strong className="mt-1 block">
                    {record.eliteCup.status === "confirmed" && record.eliteCup.data.winner
                      ? record.eliteCup.data.winner
                      : "Not archived"}
                  </strong>
                </div>
              </div>
              <details className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
                <summary className="cursor-pointer font-bold uppercase">Archive details</summary>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div><dt>Completed through</dt><dd>Year Week {record.completedThroughYearWeek}</dd></div>
                  <div><dt>Confidence</dt><dd>{record.confidence}</dd></div>
                  <div><dt>Final standings</dt><dd>{record.finalStandings.status}</dd></div>
                  <div><dt>Finals results</dt><dd>{record.leagueFinals.status}</dd></div>
                  <div><dt>Source checkpoint</dt><dd>{record.sourceCheckpoint}</dd></div>
                  <div><dt>Source signature</dt><dd className="break-all">{record.sourceSignature}</dd></div>
                </dl>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
    <p className="border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">No GOAT score, prestige formula, power ranking, or subjective legacy ranking is calculated.</p>
  </div>;
}
