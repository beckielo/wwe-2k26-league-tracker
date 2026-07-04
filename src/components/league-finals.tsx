"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildLeagueFinalsResultIdentity,
  deriveLeagueFinalsFromFinalLiveStandings,
  resolveFinalsParticipants,
  sanitizeLeagueFinalsResults,
  validateFinalsNightCompletion,
  validateLeagueFinalsResult,
  type FinalsNight,
  type LeagueFinalsMatch,
  type LeagueFinalsResult,
} from "@/domain/league-finals";
import { closeManualReview, markManualReview, reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import { LEAGUE_NAMES, type Match, type MatchResult, type MatchupReferenceRow, type SplitName, type StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { EventBrandPanel } from "./brand-assets";

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
  onReview,
}: {
  match: LeagueFinalsMatch;
  results: LeagueFinalsResult[];
  disabled: boolean;
  onSave: (result: LeagueFinalsResult) => void;
  onReview: (match: LeagueFinalsMatch, note: string) => void;
}) {
  const existing = results.find((result) => result.matchId === match.id);
  const [participantA, participantB] = resolveFinalsParticipants(match, results);
  const [selection, setSelection] = useState(existing?.resultType === "No Contest" ? "no-contest" : existing?.winner ?? "");
  const participantsReady = Boolean(participantA && participantB);
  const canSelectResult = !disabled && participantsReady;
  const [reviewNote, setReviewNote] = useState("");

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
    {match.kind === "Elite Cup Final" && !participantsReady && <p className="mt-3 text-xs font-bold text-amber-300">Complete semifinals first.</p>}
    <div className="mt-4 flex gap-2">
      <select
        aria-label={`Result for ${match.id}`}
        value={selection}
        disabled={!canSelectResult}
        onChange={(event) => setSelection(event.target.value)}
        className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#080b11] px-3 py-2 text-sm text-slate-100 shadow-inner outline-none ring-0 focus:border-red-400 focus:ring-2 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50 [&_option]:bg-[#080b11] [&_option]:text-slate-100"
      >
        <option value="">Select result</option>
        {participantA && <option value={participantA}>{participantA} wins</option>}
        {participantB && <option value={participantB}>{participantB} wins</option>}
        {match.kind === "Relegation" && <option value="no-contest">No Contest / unclear</option>}
      </select>
      <button
        type="button"
        disabled={!canSelectResult || !selection || selection === (existing?.resultType === "No Contest" ? "no-contest" : existing?.winner ?? "")}
        onClick={() => onSave({
          matchId: match.id,
          resultType: selection === "no-contest" ? "No Contest" : "Winner",
          winner: selection === "no-contest" ? null : selection,
          confirmedAt: new Date().toISOString(),
          matchIdentity: buildLeagueFinalsResultIdentity(match, results),
        })}
        className="bg-red-500 px-4 py-2 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
    </div>
    {existing && <p className="mt-2 text-xs font-bold text-emerald-300">
      Saved: {existing.resultType === "No Contest" ? `${participantA} remains in the higher league` : `${existing.winner} wins`}
    </p>}
    <details className="mt-4 border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-xs font-bold uppercase text-amber-300">Mark as Manual Review</summary>
      <textarea aria-label={`Review note for ${match.id}`} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-3 min-h-20 w-full border border-white/10 bg-[#080b11] p-2 text-sm" placeholder="Observed issue or reason for user decision" />
      <button type="button" disabled={disabled || !reviewNote.trim()} onClick={() => { onReview(match, reviewNote); setReviewNote(""); }} className="mt-2 border border-amber-400/40 px-3 py-2 text-xs font-black uppercase disabled:opacity-40">Open Manual Review</button>
    </details>
  </article>;
}

export function LeagueFinals(props: LeagueFinalsProps) {
  const { state, authority, updateState, hydrated } = useTrackerState();
  const [messages, setMessages] = useState<string[]>([]);
  const hasProvidedAuthority = authority.sourceSignature !== "workflow-default";
  const contextLeagueYear = hasProvidedAuthority ? authority.leagueYear : props.leagueYear;
  const contextSplit = hasProvidedAuthority ? authority.split : props.split;
  const contextCompletedThroughYearWeek = hasProvidedAuthority ? authority.completedThroughYearWeek : props.completedThroughWeek;
  const activeWorkflowMatches = useMemo(() => getActiveWorkflowMatches(state, props.matches), [props.matches, state]);
  const completedSplitWeek = contextSplit === "Closing Split"
    ? Math.max(0, contextCompletedThroughYearWeek - 24)
    : contextCompletedThroughYearWeek;
  const finalLiveStandings = useMemo(() => reconstructActiveSplitLiveStandings({
    previousFinalStandings: props.standings,
    postFinalsAssignments: state.activeWorkflow ? LEAGUE_NAMES.flatMap((league) => state.acceptedPostFinalsComposition?.rosters[league] ?? []) : undefined,
    scheduledMatches: activeWorkflowMatches,
    masterResults: props.results,
    localResults: hydrated ? state.confirmedResults : [],
    split: contextSplit,
    completedThroughWeek: contextCompletedThroughYearWeek,
    activeLeagueYear: contextLeagueYear,
    rosterReplacements: state.rosterReplacements,
  }).standings, [activeWorkflowMatches, contextCompletedThroughYearWeek, contextLeagueYear, contextSplit, hydrated, props.results, props.standings, state.acceptedPostFinalsComposition?.rosters, state.activeWorkflow, state.confirmedResults, state.rosterReplacements]);
  const localResults = useMemo(() => state.confirmedResults.map((result): MatchResult => {
    const match = activeWorkflowMatches.find((candidate) => candidate.id === result.matchId);
    const loser = result.resultType === "Winner" && result.winner && match
      ? (result.winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA)
      : null;
    return {
      matchId: result.matchId,
      outcome: result.resultType === "Winner" ? "decisive" : result.resultType === "Draw" ? "draw" : "no-contest",
      winner: result.winner,
      loser,
      resultSource: result.source,
      notes: null,
      source: { file: "browser-local tracker state", sheet: "confirmedResults" },
    };
  }), [activeWorkflowMatches, state.confirmedResults]);
  const localResultIds = useMemo(() => new Set(localResults.map((result) => result.matchId)), [localResults]);
  const splitReview = useMemo(() => deriveSplitCompletionReview({
    leagueYear: contextLeagueYear,
    split: contextSplit,
    completedThroughWeek: completedSplitWeek,
    standings: finalLiveStandings,
    matches: activeWorkflowMatches,
    results: [...props.results.filter((result) => !localResultIds.has(result.matchId)), ...localResults],
    matchupReference: props.matchupReference,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [activeWorkflowMatches, completedSplitWeek, contextLeagueYear, contextSplit, finalLiveStandings, localResultIds, localResults, props.hasLeagueFinalsTemplate, props.matchupReference, props.results]);
  const review = useMemo(() => deriveLeagueFinalsFromFinalLiveStandings({
    completedThroughWeek: completedSplitWeek,
    standings: finalLiveStandings,
    consequentialTies: splitReview.consequentialTies,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [completedSplitWeek, finalLiveStandings, props.hasLeagueFinalsTemplate, splitReview.consequentialTies]);
  const contextBlocked = hasProvidedAuthority && (authority.confidence === "conflicted"
    || authority.finalsReadiness === "stale"
    || authority.finalsReadiness === "invalid"
    || completedSplitWeek < 22);
  const contextBlockReason = contextBlocked
    ? `League Finals blocked: ${authority.split} context ${authority.sourceSignature} is ${authority.finalsReadiness} at Split Week ${completedSplitWeek}.`
    : null;
  const rawFinalsResults = useMemo(() => state.leagueFinalsResults ?? [], [state.leagueFinalsResults]);
  const completedNights = useMemo(() => state.completedFinalsNights ?? [], [state.completedFinalsNights]);
  const cardsRenderable = !contextBlocked && review.nightOne.length === 6 && review.nightTwo.length === 6;
  const allCardMatches = useMemo(() => [...review.nightOne, ...review.nightTwo], [review.nightOne, review.nightTwo]);
  const finalsResults = useMemo(() => sanitizeLeagueFinalsResults(allCardMatches, rawFinalsResults), [allCardMatches, rawFinalsResults]);

  useEffect(() => {
    if (!hydrated) return;
    const resultChanged = finalsResults.length !== rawFinalsResults.length
      || finalsResults.some((result, index) => JSON.stringify(result) !== JSON.stringify(rawFinalsResults[index]));
    const completedChanged = completedNights.some((entry) => validateFinalsNightCompletion(entry.night, allCardMatches, finalsResults, state.manualReviews ?? []).length > 0);
    if (!resultChanged && !completedChanged) return;
    updateState((current) => ({
      ...current,
      leagueFinalsResults: finalsResults,
      completedFinalsNights: (current.completedFinalsNights ?? []).filter((entry) => validateFinalsNightCompletion(entry.night, allCardMatches, finalsResults, current.manualReviews ?? []).length === 0),
    }));
  }, [allCardMatches, completedNights, finalsResults, hydrated, rawFinalsResults, state.manualReviews, updateState]);

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
    const errors = validateFinalsNightCompletion(night, allCardMatches, finalsResults, state.manualReviews ?? []);
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

  function openReview(match: LeagueFinalsMatch, note: string) {
    const action = markManualReview(state, {
      scope: "league-finals",
      matchId: match.id,
      league: match.higherLeague ?? "Global League",
      weekOrEvent: match.night,
      wrestlerA: resolveFinalsParticipants(match, finalsResults)[0] ?? "Unresolved participant",
      wrestlerB: resolveFinalsParticipants(match, finalsResults)[1] ?? "Unresolved participant",
      note,
    });
    if (!action.ok) return setMessages(action.errors);
    updateState(() => action.state);
    setMessages(["Manual Review opened. No result or finish type was assumed."]);
  }

  function clearReview(reviewId: string, status: "resolved" | "cleared") {
    const action = closeManualReview(state, reviewId, status);
    if (!action.ok) return setMessages(action.errors);
    updateState(() => action.state);
    setMessages([status === "resolved" ? "Manual Review resolved." : "Manual Review cleared."]);
  }

  const finalsComplete = completedNights.some((entry) => entry.night === "Night One")
    && completedNights.some((entry) => entry.night === "Night Two");
  if (!hydrated) return <div className="border border-white/10 p-6 text-slate-400">Loading League Finals state…</div>;

  return <div className="space-y-8">
    <section className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
      <div className="bg-[#111722] p-5">
        <p className="text-xs uppercase text-slate-500">Regular season</p>
        <strong className={`mt-2 block text-xl ${completedSplitWeek >= 22 ? "text-emerald-300" : "text-amber-300"}`}>
          {completedSplitWeek >= 22 ? "Complete through Week 22" : `Incomplete · Week ${completedSplitWeek} of 22`}
        </strong>
      </div>
      <div className="bg-[#111722] p-5">
        <p className="text-xs uppercase text-slate-500">Tiebreaker Review</p>
        <strong className="mt-2 block text-xl">
          {completedSplitWeek < 22 ? "Not reached" : splitReview.consequentialTies.length ? `${splitReview.consequentialTies.length} reviewed` : "No unresolved matches"}
        </strong>
      </div>
      <div className="bg-[#111722] p-5"><p className="text-xs uppercase text-slate-500">League Finals readiness</p><strong className={`mt-2 block text-xl ${review.ready && !contextBlocked ? "text-emerald-300" : "text-amber-300"}`}>{contextBlocked ? "Blocked by context authority" : review.readinessLabel}</strong></div>
    </section>


    <section className="border border-sky-400/20 bg-sky-400/5 p-6">
      <h2 className="text-xl font-black uppercase text-sky-200">League Finals Source Audit</h2>
      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        {review.sourceAudit.map((league) => <div key={league.league} className="border border-white/10 bg-[#111722] p-4">
          <h3 className="text-sm font-black uppercase">{league.league}</h3>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
            {league.ranks.map((entry) => <p key={entry.rank}><span className="text-slate-500">{entry.league} #{entry.rank}</span> <strong>{entry.wrestler ?? "Missing"}</strong></p>)}
          </div>
        </div>)}
      </div>
    </section>

    {(messages.length > 0 || review.readinessReasons.length > 0 || contextBlockReason) && <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
      {[...messages, ...review.readinessReasons, ...(contextBlockReason ? [contextBlockReason] : [])].map((message) => <p key={message}>{message}</p>)}
    </div>}

    {!review.ready && review.readinessReasons.includes("League Finals source standings are invalid or stale.") && <section className="border border-red-400/30 bg-red-400/10 p-6 text-red-100"><h2 className="font-black uppercase">League Finals source standings are invalid or stale.</h2><p className="mt-2 text-sm">Card generation is blocked so stale finals data cannot be displayed.</p></section>}

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


    {!cardsRenderable && <section className="border border-red-400/30 bg-red-400/10 p-6 text-red-100">
      <h2 className="font-black uppercase">League Finals card rendering diagnostic</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-red-200/70">Final standings valid</dt><dd className="font-bold">{review.finalStandingsValid ? "yes" : "no"}</dd></div>
        <div><dt className="text-red-200/70">Night One generated count</dt><dd className="font-bold">{review.cardRenderability.nightOneGeneratedCount}</dd></div>
        <div><dt className="text-red-200/70">Night Two generated count</dt><dd className="font-bold">{review.cardRenderability.nightTwoGeneratedCount}</dd></div>
        <div><dt className="text-red-200/70">Readiness state</dt><dd className="font-bold">{review.readinessLabel}</dd></div>
        <div><dt className="text-red-200/70">Unresolved tiebreaker count</dt><dd className="font-bold">{review.unresolvedTiebreakerCount}</dd></div>
        <div><dt className="text-red-200/70">Reason cards are hidden</dt><dd className="font-bold">{review.cardRenderability.hiddenReasons.join(" ") || "Derived card count did not reach 6 matches for each night."}</dd></div>
      </dl>
    </section>}

    {(["Night One", "Night Two"] as const).map((night) => {
      const card = night === "Night One" ? review.nightOne : review.nightTwo;
      const complete = completedNights.some((entry) => entry.night === night);
      const completionErrors = validateFinalsNightCompletion(night, allCardMatches, finalsResults, state.manualReviews ?? []);
      return <section key={night} className="finals-night-panel border border-white/10 bg-[#111722]">
        <div className="flex items-center justify-between gap-5 border-b border-white/10 p-6">
          <EventBrandPanel night={night} />
          <button type="button" disabled={complete || completionErrors.length > 0} onClick={() => completeNight(night)} className="border border-white/20 px-4 py-2 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-40">{complete ? "Complete" : `Mark ${night} complete`}</button>
        </div>
        <div className="grid gap-4 p-6 lg:grid-cols-2">
          {card.map((match) => <div key={match.id}><MatchCard match={match} results={finalsResults} disabled={complete} onSave={saveResult} onReview={openReview} />
            {(state.manualReviews ?? []).filter((item) => item.matchId === match.id && item.status === "open").map((item) => <div key={item.id} className="border border-amber-400/30 bg-amber-400/10 p-3 text-sm"><strong>Manual Review:</strong> {item.note}<div className="mt-2 flex gap-2"><button type="button" disabled={!finalsResults.some((result) => result.matchId === match.id)} onClick={() => clearReview(item.id, "resolved")} className="text-xs font-black uppercase underline disabled:opacity-40">Resolve with Winner/Loser</button><button type="button" onClick={() => clearReview(item.id, "cleared")} className="text-xs font-black uppercase underline">Clear Review</button></div></div>)}
          </div>)}
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
