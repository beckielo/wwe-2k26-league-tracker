"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deriveLeagueFinalsReview, normalizeLeagueFinalsResults } from "@/domain/league-finals";
import { getActiveWorkflowMatches, getNextSplitIdentity, getStartNextSplitStatus, startNextSplitFromAcceptedComposition } from "@/domain/schedule-setup";
import { reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { createAcceptedPostFinalsCompositionSnapshot, derivePostFinalsTransition } from "@/domain/post-finals-transition";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import { LEAGUE_NAMES, type Match, type MatchResult, type MatchupReferenceRow, type SplitName, type StandingRow } from "@/domain/types";
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
  const { state, authority, updateState, hydrated } = useTrackerState();
  const [confirmingAcceptance, setConfirmingAcceptance] = useState(false);
  const [confirmingStart, setConfirmingStart] = useState(false);
  const [startMessage, setStartMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const hasProvidedAuthority = authority.sourceSignature !== "workflow-default";
  const completedTransition = state.postFinalsTransitionCompleted;
  const authorityRepresentsActivatedSuccessor = Boolean(
    completedTransition
    && state.activeWorkflow?.leagueYear === completedTransition.nextLeagueYear
    && state.activeWorkflow?.split === completedTransition.nextSplit,
  );
  const contextLeagueYear = authorityRepresentsActivatedSuccessor
    ? completedTransition!.leagueYear
    : hasProvidedAuthority ? authority.leagueYear : props.leagueYear;
  const contextSplit = authorityRepresentsActivatedSuccessor
    ? completedTransition!.split
    : hasProvidedAuthority ? authority.split : props.split;
  const contextCompletedThroughYearWeek = authorityRepresentsActivatedSuccessor
    ? (completedTransition!.split === "Closing Split" ? 46 : 22)
    : hasProvidedAuthority ? authority.completedThroughYearWeek : props.completedThroughWeek;
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
    baselineCompletedThroughYearWeek: props.completedThroughWeek,
    activeLeagueYear: contextLeagueYear,
    rosterReplacements: state.rosterReplacements,
  }).standings, [activeWorkflowMatches, contextCompletedThroughYearWeek, contextLeagueYear, contextSplit, hydrated, props.completedThroughWeek, props.results, props.standings, state.acceptedPostFinalsComposition?.rosters, state.activeWorkflow, state.confirmedResults, state.rosterReplacements]);
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
  const finals = useMemo(() => deriveLeagueFinalsReview({
    completedThroughWeek: completedSplitWeek,
    standings: finalLiveStandings,
    consequentialTies: splitReview.consequentialTies,
    hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate,
  }), [completedSplitWeek, props.hasLeagueFinalsTemplate, splitReview.consequentialTies, finalLiveStandings]);
  const allFinalsMatches = useMemo(() => [...finals.nightOne, ...finals.nightTwo], [finals.nightOne, finals.nightTwo]);
  const normalizedResults = useMemo(() => normalizeLeagueFinalsResults(allFinalsMatches, state.leagueFinalsResults ?? []), [allFinalsMatches, state.leagueFinalsResults]);
  useEffect(() => {
    if (!hydrated || normalizedResults.repairedPayloads.length === 0) return;
    const current = state.leagueFinalsResults ?? [];
    const changed = normalizedResults.results.length !== current.length
      || normalizedResults.results.some((result, index) => JSON.stringify(result) !== JSON.stringify(current[index]));
    if (!changed) return;
    updateState((current) => ({ ...current, leagueFinalsResults: normalizedResults.results }));
  }, [hydrated, normalizedResults, state.leagueFinalsResults, updateState]);
  const transition = useMemo(() => derivePostFinalsTransition({
    completedThroughWeek: completedSplitWeek,
    standings: finalLiveStandings,
    consequentialTies: splitReview.consequentialTies,
    matches: allFinalsMatches,
    results: state.leagueFinalsResults ?? [],
    completedNights: state.completedFinalsNights ?? [],
    champions: finals.champions,
    directMovements: finals.directMovements,
    hasAuthoritativeClosingSchedule: props.hasAuthoritativeClosingSchedule,
    manualReviews: state.manualReviews,
  }), [allFinalsMatches, completedSplitWeek, finals.champions, finals.directMovements, props.hasAuthoritativeClosingSchedule, splitReview.consequentialTies, finalLiveStandings, state.completedFinalsNights, state.leagueFinalsResults, state.manualReviews]);
  const acceptedComposition = state.acceptedPostFinalsComposition;
  const targetSplitIdentity = getNextSplitIdentity(contextLeagueYear, contextSplit);
  const nextSplitWorkflowActive = Boolean(
    state.activeWorkflow?.leagueYear === targetSplitIdentity.leagueYear
    && state.activeWorkflow?.split === targetSplitIdentity.split
    && state.activeWorkflow?.splitWeek === 1,
  );
  const accepted = Boolean(acceptedComposition?.postFinalsCompositionAccepted && (acceptedComposition.sourceSignature === transition.movementSourceAudit.sourceSignature || nextSplitWorkflowActive));
  const startStatus = getStartNextSplitStatus({
    state,
    completedLeagueYear: contextLeagueYear,
    completedSplit: contextSplit,
    acceptedSourceSignature: transition.movementSourceAudit.sourceSignature,
  });
  const nextSplitActive = nextSplitWorkflowActive || startStatus.disabledReason === "Next Split Active";
  const contextDisabledReason = hasProvidedAuthority && !authorityRepresentsActivatedSuccessor && (authority.confidence === "conflicted"
    || authority.finalsReadiness === "stale"
    || authority.finalsReadiness === "invalid"
    || completedSplitWeek < 22)
    ? `Workflow context ${authority.sourceSignature} is not valid for Finals transition.`
    : null;
  const reviewDisabledReason = contextDisabledReason
    ?? (!transition.finalsComplete
    ? "Complete League Finals first."
    : !transition.compositionValid
      ? "Composition must be valid before review."
      : null);
  const acceptComposition = () => {
    if (reviewDisabledReason || accepted) return;
    const snapshot = createAcceptedPostFinalsCompositionSnapshot({
      transition,
      leagueYear: contextLeagueYear,
      split: contextSplit,
    });
    updateState((current) => current.acceptedPostFinalsComposition?.sourceSignature === snapshot.sourceSignature
      ? current
      : { ...current, acceptedPostFinalsComposition: snapshot });
    setConfirmingAcceptance(false);
  };
  const startNextSplit = () => {
    const action = startNextSplitFromAcceptedComposition({
      state,
      completedLeagueYear: contextLeagueYear,
      completedSplit: contextSplit,
      acceptedSourceSignature: transition.movementSourceAudit.sourceSignature,
      currentUserWrestler: state.currentUserWrestler,
      completedSplitLegacyCommit: {
        titleRecords: transition.champions.map((champion) => ({ league: champion.league, wrestler: champion.wrestler })),
        eliteCupWinner: transition.legacyFacts.find((fact) => fact.label === "Global Elite Cup Winner")?.wrestler ?? null,
        eliteCupRunnerUp: transition.legacyFacts.find((fact) => fact.label === "Global Elite Cup Runner-up")?.wrestler ?? null,
      },
    });
    if (action.errors.length) {
      setStartMessage({ tone: "error", text: action.errors[0] });
      setConfirmingStart(false);
      return;
    }
    updateState(() => action.state);
    setStartMessage({ tone: "success", text: "Next split started. Returning to dashboard…" });
    setConfirmingStart(false);
    if (process.env.NODE_ENV !== "test") window.location.assign("/");
  };

  if (!hydrated) return <div className="border border-white/10 p-6 text-slate-400">Loading Post-Finals Transition state…</div>;

  return <div className="space-y-8">
    <section className={`border p-6 ${transition.unlocked ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
      <p className="text-xs font-black uppercase tracking-[.18em]">Completion gate</p>
      <h2 className="mt-2 text-2xl font-black uppercase">{transition.unlocked ? "Post-Finals Transition unlocked" : transition.lockedMessage}</h2>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p>Night One: <strong>{transition.nightCompletion["Night One"] ? "Complete" : "Incomplete"}</strong></p>
        <p>Night Two: <strong>{transition.nightCompletion["Night Two"] ? "Complete" : "Incomplete"}</strong></p>
        <p>League Finals complete: <strong>{transition.finalsComplete ? "Yes" : "No"}</strong></p>
        <p>Post-Finals league composition valid: <strong>{transition.compositionValid ? "Yes" : "No"}</strong></p>
        <p>League Finals page model valid: <strong>{transition.diagnostics.leagueFinalsPageModelValid ? "Yes" : "No"}</strong></p>
        <p>Pre-finals tiebreaker state ignored after completed Finals: <strong>{transition.diagnostics.preFinalsTiebreakerStateIgnoredAfterCompletedFinals ? "yes" : "no"}</strong></p>
        <p>Opening split readiness ignored after completed Finals: <strong>{transition.diagnostics.openingSplitReadinessIgnoredAfterCompletedFinals ? "yes" : "no"}</strong></p>
        <p>Composition validation result: <strong>{transition.diagnostics.compositionValidationResult}</strong></p>
        <p>Composition league sizes: <strong>{Object.entries(transition.diagnostics.compositionLeagueSizes).map(([league, count]) => `${league}: ${count}`).join(" · ")}</strong></p>
      </div>
      {transition.missingResults.length > 0 && <div className="mt-4"><strong>Missing League Finals results</strong><ul className="list-disc pl-5 text-sm">{transition.missingResults.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {transition.invalidResults.length > 0 && <div className="mt-4"><strong>Invalid / ambiguous results</strong><ul className="list-disc pl-5 text-sm">{transition.invalidResults.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {(transition.invalidResults.length > 0 || transition.missingResults.length > 0) && <details className="mt-4 text-xs">
        <summary className="cursor-pointer font-black uppercase">Reconciliation diagnostics</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div><dt>Saved result keys</dt><dd>{transition.diagnostics.savedLeagueFinalsResultKeys.join(", ") || "none"}</dd></div>
          <div><dt>Canonical match IDs</dt><dd>{transition.diagnostics.canonicalAuthoritativeFinalsMatchIds.join(", ") || "none"}</dd></div>
          <div><dt>Saved canonical IDs found</dt><dd>{transition.diagnostics.savedCanonicalIdsFound.join(", ") || "none"}</dd></div>
          <div><dt>Parsed valid results</dt><dd>{transition.diagnostics.parsedValidResultsCount}</dd></div>
          <div><dt>Invalid results</dt><dd>{transition.diagnostics.invalidWinnerOutcomeCount}</dd></div>
          <div><dt>Repaired payloads</dt><dd>{transition.diagnostics.repairedPayloadCount}</dd></div>
          <div><dt>Stale metadata ignored</dt><dd>{transition.diagnostics.staleMetadataIgnoredCount}</dd></div>
          <div><dt>Migrated legacy result keys</dt><dd>{transition.diagnostics.migratedLegacyResultKeysCount}</dd></div>
          <div><dt>Unmatched saved results</dt><dd>{transition.diagnostics.unmatchedSavedResultsCount}</dd></div>
          <div><dt>Missing authoritative finals</dt><dd>{transition.diagnostics.missingAuthoritativeFinalsCount}</dd></div>
          <div><dt>Missing canonical IDs</dt><dd>{transition.diagnostics.missingCanonicalIds.join(", ") || "none"}</dd></div>
          <div><dt>Extra unmatched saved IDs</dt><dd>{transition.diagnostics.extraUnmatchedSavedIds.join(", ") || "none"}</dd></div>
        </dl>
        {transition.diagnostics.invalidWinnerOutcomeCount > 0 && <pre className="mt-3 overflow-auto whitespace-pre-wrap border border-white/10 bg-black/20 p-3 text-[10px] text-slate-300">{JSON.stringify(transition.diagnostics.resultWinnerReconciliation.filter((row) => row.validationReason), null, 2)}</pre>}
      </details>}
    </section>

    {!transition.finalsComplete && <section className="border border-white/10 bg-[#111722] p-6">
      <h2 className="text-xl font-black uppercase">New league composition preview</h2>
      <p className="mt-2 text-sm font-bold text-amber-300">Review Required</p>
      <button
        type="button"
        disabled
        className="mt-4 border border-emerald-300/40 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-emerald-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
      >
        Review New League Composition
      </button>
      <p className="mt-3 text-sm font-bold text-amber-200" role="status">{reviewDisabledReason}</p>
    </section>}

    {transition.finalsComplete && <>
      <section className="border border-sky-400/20 bg-sky-400/5 p-6">
        <h2 className="text-xl font-black uppercase">Post-Finals Movement Source Audit</h2>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div><dt className="font-bold uppercase text-slate-400">Source</dt><dd>{transition.movementSourceAudit.source}</dd></div>
          <div><dt className="font-bold uppercase text-slate-400">Source signature</dt><dd className="break-all text-slate-200">{transition.movementSourceAudit.sourceSignature}</dd></div>
          <div><dt className="font-bold uppercase text-slate-400">Direct movement source</dt><dd>{transition.movementSourceAudit.directMovementSource}</dd></div>
          <div><dt className="font-bold uppercase text-slate-400">Post-Finals and League Finals signatures match</dt><dd>{transition.movementSourceAudit.signaturesMatch ? "yes" : "no"}</dd></div>
          <div><dt className="font-bold uppercase text-slate-400">Cached direct movement ignored</dt><dd>{transition.movementSourceAudit.cachedDirectMovementIgnored ? "yes" : "no"}</dd></div>
        </dl>
        {transition.movementSourceAudit.mismatchMessage && <p className="mt-3 border border-red-400/30 bg-red-400/10 p-3 text-sm font-bold text-red-200">{transition.movementSourceAudit.mismatchMessage}</p>}
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{transition.movementSourceAudit.directMovers.map((mover) => <div key={mover.slot} className="border border-white/10 p-3"><strong>{mover.slot}</strong><p className="text-slate-400">{mover.wrestler ?? "Missing"} → {mover.targetLeague}</p></div>)}</div>
      </section>

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
        {accepted && <p className="mt-3 text-sm font-black text-emerald-200" role="status">Post-Finals composition accepted</p>}
        <button
          type="button"
          disabled={Boolean(reviewDisabledReason) || accepted}
          onClick={() => setConfirmingAcceptance(true)}
          className="mt-4 border border-emerald-300/40 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-emerald-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        >
          {accepted ? "Composition Accepted" : "Review New League Composition"}
        </button>
        {reviewDisabledReason && <p className="mt-3 text-sm font-bold text-amber-200" role="status">{reviewDisabledReason}</p>}
        {accepted && <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!startStatus.enabled}
            onClick={() => setConfirmingStart(true)}
            className="bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {nextSplitActive ? "Next Split Active" : "Start Next Split"}
          </button>
          {nextSplitActive && <Link href="/" className="border border-sky-300/40 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-sky-100">Open Dashboard</Link>}
          {!nextSplitActive && startStatus.disabledReason && <p className="text-sm font-bold text-amber-200" role="status">{startStatus.disabledReason}</p>}
        </div>}
        {startMessage && <p role={startMessage.tone === "error" ? "alert" : "status"} className={`mt-3 text-sm font-bold ${startMessage.tone === "error" ? "text-amber-200" : "text-emerald-200"}`}>{startMessage.text}</p>}
        {confirmingStart && <div role="dialog" aria-modal="true" aria-labelledby="start-next-split-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-lg border border-red-300/40 bg-[#111722] p-6 shadow-2xl">
            <h3 id="start-next-split-title" className="text-xl font-black uppercase">Start Next Split?</h3>
            <p className="mt-3 text-sm text-slate-300">This will activate the accepted post-finals 4x12 league composition as the next split baseline and generate the regular-season schedule. The workbook will not be mutated automatically.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="bg-red-500 px-4 py-2 font-black uppercase text-white" onClick={startNextSplit}>Start Next Split</button>
              <button type="button" className="border border-white/20 px-4 py-2 font-bold" onClick={() => setConfirmingStart(false)}>Cancel</button>
            </div>
          </div>
        </div>}
        {confirmingAcceptance && <div role="dialog" aria-modal="true" aria-labelledby="accept-composition-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-lg border border-emerald-300/40 bg-[#111722] p-6 shadow-2xl">
            <h3 id="accept-composition-title" className="text-xl font-black uppercase">Accept New League Composition?</h3>
            <p className="mt-3 text-sm text-slate-300">This will save the reviewed 4x12 post-finals league composition as the roster baseline for the next split setup. The workbook will not be mutated automatically.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="bg-red-500 px-4 py-2 font-black uppercase text-white" onClick={acceptComposition}>Accept Composition</button>
              <button type="button" className="border border-white/20 px-4 py-2 font-bold" onClick={() => setConfirmingAcceptance(false)}>Cancel</button>
            </div>
          </div>
        </div>}
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
