"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  deriveLeagueFinalsReview,
  resolveFinalsParticipants,
  validateFinalsNightCompletion,
  validateLeagueFinalsResult,
  type FinalsNight,
  type LeagueFinalsMatch,
  type LeagueFinalsResult,
} from "@/domain/league-finals";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import type { Match, MatchResult, MatchupReferenceRow, SplitName, StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface LeagueFinalsProps {
  completedThroughWeek: number;
  leagueYear: number;
  split: SplitName;
  standings: StandingRow[];
  matches: Match[];
  results: MatchResult[];
  matchupReference: MatchupReferenceRow[];
  hasLeagueFinalsTemplate: boolean;
}

function MatchCard({
  match,
  results,
  disabled,
  onSave,
}: {
  match: LeagueFinalsMatch;
  results: LeagueFinalsResult[];
  disabled: boolean;
  onSave: (result: LeagueFinalsResult) => void;
}) {
  const existing = results.find((result) => result.matchId === match.id);
  const [participantA, participantB] = resolveFinalsParticipants(match, results);
  const [selection, setSelection] = useState(existing?.resultType === "No Contest" ? "no-contest" : existing?.winner ?? "");
  const participantsReady = Boolean(participantA && participantB);

  return <article className="border border-white/10 bg-white/[.025] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">
          Match {match.matchNumber} · {match.kind}
        </p>
        <h3 className="mt-1 font-black uppercase">
          {participantA ?? "Winner SF1"} <span className="text-red-400">vs</span> {participantB ?? "Winner SF2"}
        </h3>
      </div>
      <span className="border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
        Source-derived
      </span>
    </div>
    <p className="mt-3 text-xs text-slate-400">{match.stipulation} · {match.resultMeaning}</p>
    <p className="mt-1 text-[10px] text-slate-600">{match.sourceLabel}</p>
    <div className="mt-4 flex gap-2">
      <select
        aria-label={`Result for ${match.id}`}
        value={selection}
        disabled={disabled || !participantsReady}
        onChange={(event) => setSelection(event.target.value)}
        className="min-w-0 flex-1 border border-white/10 bg-[#080b11] px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">Select result</option>
        {participantA && <option value={participantA}>{participantA} wins</option>}
        {participantB && <option value={participantB}>{participantB} wins</option>}
        {match.kind === "Relegation" && <option value="no-contest">No Contest / unclear</option>}
      </select>
      <button
        type="button"
        disabled={disabled || !selection || !participantsReady}
        onClick={() => onSave({
          matchId: match.id,
          resultType: selection === "no-contest" ? "No Contest" : "Winner",
          winner: selection === "no-contest" ? null : selection,
          confirmedAt: new Date().toISOString(),
        })}
        className="bg-red-500 px-4 py-2 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
    </div>
    {existing && <p className="mt-2 text-xs font-bold text-emerald-300">
      Saved: {existing.resultType === "No Contest" ? `${participantA} remains in the higher league` : `${existing.winner} wins`}
    </p>}
  </article>;
}

export function LeagueFinals(props: LeagueFinalsProps) {
  const { state, updateState, hydrated } = useTrackerState();
  const [messages, setMessages] = useState<string[]>([]);
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
  const review = useMemo(() => deriveLeagueFinalsReview({
    completedThroughWeek: props.completedThroughWeek,
    standings: splitReview.finalRegularStandings,
    consequentialTies: splitReview.consequentialTies,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [props.completedThroughWeek, props.hasLeagueFinalsTemplate, splitReview]);
  const finalsResults = state.leagueFinalsResults ?? [];
  const completedNights = state.completedFinalsNights ?? [];
  const allCardMatches = [...review.nightOne, ...review.nightTwo];

  function saveResult(result: LeagueFinalsResult) {
    const errors = validateLeagueFinalsResult(result, allCardMatches, finalsResults);
    if (errors.length) return setMessages(errors);
    updateState((current) => ({
      ...current,
      leagueFinalsResults: [...(current.leagueFinalsResults ?? []).filter((entry) => entry.matchId !== result.matchId), result],
    }));
    setMessages([]);
  }

  function completeNight(night: FinalsNight) {
    const errors = validateFinalsNightCompletion(night, allCardMatches, finalsResults);
    if (errors.length) return setMessages(errors);
    updateState((current) => ({
      ...current,
      completedFinalsNights: [
        ...(current.completedFinalsNights ?? []).filter((entry) => entry.night !== night),
        { night, completedAt: new Date().toISOString() },
      ],
    }));
    setMessages([`${night} complete and locked.`]);
  }

  const finalsComplete = completedNights.some((entry) => entry.night === "Night One")
    && completedNights.some((entry) => entry.night === "Night Two");
  if (!hydrated) return <div className="border border-white/10 p-6 text-slate-400">Loading League Finals state…</div>;

  return <div className="space-y-8">
    <section className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
      <div className="bg-[#111722] p-5"><p className="text-xs uppercase text-slate-500">Regular season</p><strong className="mt-2 block text-xl text-emerald-300">Complete through Week 22</strong></div>
      <div className="bg-[#111722] p-5"><p className="text-xs uppercase text-slate-500">Tiebreaker Review</p><strong className="mt-2 block text-xl">{splitReview.consequentialTies.length ? `${splitReview.consequentialTies.length} reviewed` : "No unresolved matches"}</strong></div>
      <div className="bg-[#111722] p-5"><p className="text-xs uppercase text-slate-500">League Finals readiness</p><strong className={`mt-2 block text-xl ${review.ready ? "text-emerald-300" : "text-amber-300"}`}>{review.readinessLabel}</strong></div>
    </section>

    {(messages.length > 0 || review.readinessReasons.length > 0) && <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
      {[...messages, ...review.readinessReasons].map((message) => <p key={message}>{message}</p>)}
    </div>}

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="border border-white/10 bg-[#111722] p-6">
        <h2 className="text-xl font-black uppercase">League champions</h2>
        <div className="mt-4 space-y-2">{review.champions.map((champion) => <div key={champion.league} className="flex justify-between border-b border-white/10 py-2 text-sm"><span>{champion.league}</span><strong>{champion.wrestler}</strong></div>)}</div>
        <p className="mt-4 text-xs text-slate-500">Global #1 remains Global League Champion regardless of the separate Elite Cup result.</p>
      </div>
      <div className="border border-white/10 bg-[#111722] p-6">
        <h2 className="text-xl font-black uppercase">Direct movement</h2>
        <div className="mt-4 space-y-2">{review.directMovements.map((movement) => <div key={`${movement.reason}-${movement.wrestler}`} className="border-b border-white/10 py-2 text-sm"><strong>{movement.wrestler}</strong><p className="text-xs text-slate-400">{movement.reason}: {movement.fromLeague} → {movement.toLeague}</p></div>)}</div>
      </div>
    </section>

    <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">Global Elite Cup qualified field</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{review.eliteCupQualifiers.map((row) => <div key={row.wrestler} className="border border-white/10 p-4"><span className="text-xs text-slate-500">Global #{row.rank}</span><strong className="mt-1 block">{row.wrestler}</strong></div>)}</div>
    </section>

    {(["Night One", "Night Two"] as const).map((night) => {
      const card = night === "Night One" ? review.nightOne : review.nightTwo;
      const complete = completedNights.some((entry) => entry.night === night);
      return <section key={night} className="border border-white/10 bg-[#111722]">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-red-400">Week 24</p><h2 className="text-2xl font-black uppercase">{night} card</h2></div>
          <button type="button" disabled={!review.ready || complete} onClick={() => completeNight(night)} className="border border-white/20 px-4 py-2 text-xs font-black uppercase disabled:opacity-40">{complete ? "Complete" : `Mark ${night} complete`}</button>
        </div>
        <div className="grid gap-4 p-6 lg:grid-cols-2">
          {card.map((match) => <MatchCard key={match.id} match={match} results={finalsResults} disabled={!review.ready || complete} onSave={saveResult} />)}
        </div>
      </section>;
    })}

    <section className="border border-amber-400/30 bg-amber-400/5 p-6">
      <h2 className="font-black uppercase text-amber-300">Review Required & source warnings</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">{[...review.reviewRequired, ...review.sourceWarnings].map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </section>

    <section className={`border p-6 ${finalsComplete ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/[.02]"}`}>
      <h2 className="font-black uppercase">{finalsComplete ? "League Finals complete. Next step: Phase 9B Post-Finals Transition." : "Post-Finals transition locked"}</h2>
      <p className="mt-2 text-sm text-slate-400">Phase 9 does not create a Closing Split roster, change league composition, or invent Week 25.</p>
      {finalsComplete
        ? <Link href="/post-finals-transition" className="mt-4 inline-block bg-emerald-400 px-4 py-2 text-xs font-black uppercase text-black">Open Post-Finals Transition</Link>
        : <button type="button" disabled className="mt-4 border border-white/10 px-4 py-2 text-xs font-black uppercase opacity-40">Phase 9B unavailable</button>}
    </section>
  </div>;
}
