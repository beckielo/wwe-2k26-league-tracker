"use client";

import { useMemo } from "react";
import { deriveLeagueFinalsReview } from "@/domain/league-finals";
import { derivePostFinalsTransition } from "@/domain/post-finals-transition";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import type { Match, MatchResult, MatchupReferenceRow, SplitName, StandingRow } from "@/domain/types";
import { deriveYearRolloverContinuity } from "@/domain/year-rollover-continuity";
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
  nextSchedule: Match[];
}

export function YearRolloverContinuityView(props: Props) {
  const { state, hydrated } = useTrackerState();
  const continuity = useMemo(() => {
    const splitReview = deriveSplitCompletionReview({
      leagueYear: props.leagueYear,
      split: props.split,
      completedThroughWeek: props.completedThroughWeek,
      standings: props.standings,
      matches: props.matches,
      results: props.results,
      matchupReference: props.matchupReference,
      hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
    });
    const finals = deriveLeagueFinalsReview({
      completedThroughWeek: props.completedThroughWeek,
      standings: splitReview.finalRegularStandings,
      consequentialTies: splitReview.consequentialTies,
      hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
    });
    const transition = derivePostFinalsTransition({
      completedThroughWeek: props.completedThroughWeek,
      standings: splitReview.finalRegularStandings,
      consequentialTies: splitReview.consequentialTies,
      matches: [...finals.nightOne, ...finals.nightTwo],
      results: state.leagueFinalsResults ?? [],
      completedNights: state.completedFinalsNights ?? [],
      champions: finals.champions,
      directMovements: finals.directMovements,
      hasAuthoritativeClosingSchedule: props.nextSchedule.length > 0,
      manualReviews: state.manualReviews,
    });
    return deriveYearRolloverContinuity({
      leagueYear: props.leagueYear,
      split: props.split,
      completedThroughWeek: props.completedThroughWeek,
      previousFinalStandings: splitReview.finalRegularStandings,
      transition,
      nextSchedule: props.nextSchedule,
      hasOpenManualReviews: (state.manualReviews ?? []).some((review) => review.status === "open"),
    });
  }, [props, state]);

  if (!hydrated) return <div className="border border-white/10 p-6 text-slate-400">Loading continuity state…</div>;

  return <div className="space-y-8">
    <section className={`border p-6 ${continuity.setupAllowed ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
      <p className="text-xs font-black uppercase tracking-[.18em]">Next allowed action</p>
      <h2 className="mt-2 text-2xl font-black uppercase">{continuity.nextAction}</h2>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p>Current: <strong>Year {continuity.currentLeagueYear} · {continuity.currentSplit}</strong></p>
        <p>League Finals: <strong>{continuity.leagueFinalsComplete ? "Complete" : "Incomplete"}</strong></p>
        <p>Phase 9B: <strong>{continuity.postFinalsTransitionValid ? "Valid" : "Blocked"}</strong></p>
        <p>Next: <strong>Year {continuity.nextLeagueYear} · {continuity.nextSplit}</strong></p>
      </div>
    </section>

    <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">Proposed composition & seed continuity</h2>
      <p className="mt-2 max-w-5xl text-sm text-slate-400">{continuity.seedContinuity.orderingExplanation}</p>
      <div className="mt-5 grid gap-5 xl:grid-cols-4">
        {Object.entries(continuity.seedContinuity.seeds).map(([league, seeds]) => <div key={league} className="border border-white/10 p-4">
          <h3 className="font-black uppercase">{league}</h3>
          <ol className="mt-3 space-y-2">{seeds.map((row) => <li key={row.wrestler} className="text-sm">
            <span className="mr-2 text-slate-500">{row.seed}.</span><strong>{row.wrestler}</strong>
            <span className="block pl-6 text-[11px] text-slate-500">{row.priorLeague} #{row.priorRank} · {row.movement}</span>
          </li>)}</ol>
        </div>)}
      </div>
      {continuity.seedContinuity.errors.length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-amber-200">{continuity.seedContinuity.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </section>

    <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">Schedule readiness</h2>
      <p className={`mt-3 font-bold ${continuity.scheduleReadiness.ready ? "text-emerald-300" : "text-amber-300"}`}>{continuity.scheduleReadiness.message}</p>
      {continuity.scheduleReadiness.errors.length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-slate-300">{continuity.scheduleReadiness.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      <p className="mt-4 text-xs text-slate-500">Normal Week 25 and new Year Week 1 remain locked until the authoritative schedule/template passes validation.</p>
    </section>

    <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">History / legacy facts to save</h2>
      <p className="mt-2 text-sm font-bold text-amber-300">{continuity.legacyFormulaMessage}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{continuity.historyFacts.map((fact, index) => <div key={`${fact.label}-${fact.wrestler}-${index}`} className="border border-white/10 p-4">
        <p className="text-[10px] font-black uppercase text-red-400">Year {fact.leagueYear} · {fact.split}</p>
        <p className="mt-1 text-xs font-bold uppercase">{fact.label}</p>
        <strong className="mt-1 block">{fact.wrestler}</strong>
        <p className="mt-1 text-xs text-slate-500">{fact.detail}</p>
      </div>)}</div>
    </section>
  </div>;
}
