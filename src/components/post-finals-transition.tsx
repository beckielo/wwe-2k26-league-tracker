"use client";

import { useMemo } from "react";
import { deriveLeagueFinalsReview } from "@/domain/league-finals";
import { derivePostFinalsTransition } from "@/domain/post-finals-transition";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import type { Match, MatchResult, MatchupReferenceRow, SplitName, StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface Props {
  completedThroughWeek: number;
  leagueYear: number;
  split: SplitName;
  standings: StandingRow[];
  matches: Match[];
  results: MatchResult[];
  matchupReference: MatchupReferenceRow[];
  hasLeagueFinalsTemplate: boolean;
  hasAuthoritativeClosingSchedule: boolean;
}

export function PostFinalsTransitionView(props: Props) {
  const { state, hydrated } = useTrackerState();
  const splitReview = useMemo(() => deriveSplitCompletionReview({
    leagueYear: props.leagueYear,
    split: props.split,
    completedThroughWeek: props.completedThroughWeek,
    standings: props.standings,
    matches: props.matches,
    results: props.results,
    matchupReference: props.matchupReference,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [props]);
  const finals = useMemo(() => deriveLeagueFinalsReview({
    completedThroughWeek: props.completedThroughWeek,
    standings: splitReview.finalRegularStandings,
    consequentialTies: splitReview.consequentialTies,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [props.completedThroughWeek, props.hasLeagueFinalsTemplate, splitReview]);
  const transition = useMemo(() => derivePostFinalsTransition({
    completedThroughWeek: props.completedThroughWeek,
    standings: splitReview.finalRegularStandings,
    consequentialTies: splitReview.consequentialTies,
    matches: [...finals.nightOne, ...finals.nightTwo],
    results: state.leagueFinalsResults ?? [],
    completedNights: state.completedFinalsNights ?? [],
    champions: finals.champions,
    directMovements: finals.directMovements,
    hasAuthoritativeClosingSchedule: props.hasAuthoritativeClosingSchedule,
    manualReviews: state.manualReviews,
  }), [finals, props.completedThroughWeek, props.hasAuthoritativeClosingSchedule, splitReview, state]);

  if (!hydrated) return <div className="border border-white/10 p-6 text-slate-400">Loading Post-Finals Transition state…</div>;

  return <div className="space-y-8">
    <section className={`border p-6 ${transition.unlocked ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
      <p className="text-xs font-black uppercase tracking-[.18em]">Completion gate</p>
      <h2 className="mt-2 text-2xl font-black uppercase">{transition.unlocked ? "Post-Finals Transition unlocked" : transition.lockedMessage}</h2>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p>Night One: <strong>{transition.nightCompletion["Night One"] ? "Complete" : "Incomplete"}</strong></p>
        <p>Night Two: <strong>{transition.nightCompletion["Night Two"] ? "Complete" : "Incomplete"}</strong></p>
      </div>
      {transition.missingResults.length > 0 && <div className="mt-4"><strong>Missing League Finals results</strong><ul className="list-disc pl-5 text-sm">{transition.missingResults.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {transition.invalidResults.length > 0 && <div className="mt-4"><strong>Invalid / ambiguous results</strong><ul className="list-disc pl-5 text-sm">{transition.invalidResults.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>

    {transition.unlocked && <>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="border border-white/10 bg-[#111722] p-6">
          <h2 className="text-xl font-black uppercase">Direct movements</h2>
          <div className="mt-4 space-y-3">{transition.directMovements.map((item) => <div key={`${item.reason}-${item.wrestler}`} className="border-b border-white/10 pb-3 text-sm"><strong>{item.wrestler}</strong><p className="text-slate-400">{item.reason}: {item.fromLeague} → {item.toLeague}</p></div>)}</div>
        </div>
        <div className="border border-white/10 bg-[#111722] p-6">
          <h2 className="text-xl font-black uppercase">Relegation outcomes</h2>
          <div className="mt-4 space-y-3">{transition.relegationOutcomes.map((item) => <div key={item.matchId} className="border-b border-white/10 pb-3 text-sm"><strong>{item.outcome}</strong><p className="text-slate-400">{item.higherLeagueWrestler} / {item.lowerLeagueWrestler}{item.winner ? ` · Winner: ${item.winner}` : ""}</p></div>)}</div>
        </div>
      </section>

      <section className="border border-white/10 bg-[#111722] p-6">
        <h2 className="text-xl font-black uppercase">New league composition preview</h2>
        <p className={`mt-2 text-sm font-bold ${transition.compositionValid ? "text-emerald-300" : "text-amber-300"}`}>{transition.compositionValid ? "Post-Finals league composition valid" : "Review Required"}</p>
        <div className="mt-5 grid gap-5 xl:grid-cols-4">{transition.proposedOrder.map((group) => <div key={group.league} className="border border-white/10 p-4">
          <h3 className="font-black uppercase">{group.league}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase text-amber-300">Proposed seed order / Review Required</p>
          <ol className="mt-3 space-y-2">{group.wrestlers.map((row, index) => <li key={row.wrestler} className="text-sm"><span className="mr-2 text-slate-500">{index + 1}.</span><strong>{row.wrestler}</strong><span className="block pl-6 text-[11px] text-slate-500">{row.priorLeague} #{row.priorRank} · {row.movement}</span></li>)}</ol>
        </div>)}</div>
      </section>

      <section className="border border-white/10 bg-[#111722] p-6">
        <h2 className="text-xl font-black uppercase">History / legacy facts preserved</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{transition.legacyFacts.map((fact, index) => <div key={`${fact.label}-${fact.wrestler}-${index}`} className="border border-white/10 p-4"><p className="text-[10px] font-black uppercase text-red-400">{fact.label}</p><strong className="mt-1 block">{fact.wrestler}</strong><p className="mt-1 text-xs text-slate-500">{fact.detail}</p></div>)}</div>
      </section>
    </>}

    <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">Closing Split readiness</h2>
      <ul className="mt-4 space-y-2 text-sm">
        <li>Opening Split complete: <strong>{transition.openingSplitComplete ? "Yes" : "No"}</strong></li>
        <li>League Finals complete: <strong>{transition.finalsComplete ? "Yes" : "No"}</strong></li>
        <li>Post-Finals league composition valid: <strong>{transition.compositionValid ? "Yes" : "No"}</strong></li>
        <li>Closing Split setup: <strong>{transition.closingSplitSetupReady ? "Ready" : "Review Required"}</strong></li>
      </ul>
      {transition.closingScheduleMessage && <p className="mt-4 border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">{transition.closingScheduleMessage}</p>}
    </section>

    <section className="border border-amber-400/30 bg-amber-400/5 p-6">
      <h2 className="font-black uppercase text-amber-300">Review Required & boundaries</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">{[...transition.reviewRequired, ...transition.compositionErrors, ...transition.warnings].map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  </div>;
}
