"use client";

import { useMemo, useState } from "react";
import { deriveLeagueFinalsReview } from "@/domain/league-finals";
import { derivePostFinalsTransition } from "@/domain/post-finals-transition";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import { assignContinuitySeeds } from "@/domain/year-rollover-continuity";
import { canActivateNextWeek, createAcceptedScheduleSnapshot, generateSchedule, getScheduleAcceptanceStatus, importScheduleJson, validateSchedule, type GeneratedScheduleMatch } from "@/domain/schedule-setup";
import { LEAGUE_NAMES, type Match, type MatchResult, type MatchupReferenceRow, type SplitName, type StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface Props { leagueYear: number; split: SplitName; completedThroughWeek: number; standings: StandingRow[]; matches: Match[]; results: MatchResult[]; matchupReference: MatchupReferenceRow[]; hasLeagueFinalsTemplate: boolean }

export function ScheduleSetupView(props: Props) {
  const { state, updateState, hydrated } = useTrackerState();
  const [preview, setPreview] = useState<GeneratedScheduleMatch[]>([]);
  const [importText, setImportText] = useState("");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const readiness = useMemo(() => {
    const splitReview = deriveSplitCompletionReview({ ...props });
    const finals = deriveLeagueFinalsReview({ completedThroughWeek: props.completedThroughWeek, standings: splitReview.finalRegularStandings, consequentialTies: splitReview.consequentialTies, hasLeagueFinalsTemplate: props.hasLeagueFinalsTemplate });
    const transition = derivePostFinalsTransition({ completedThroughWeek: props.completedThroughWeek, standings: splitReview.finalRegularStandings, consequentialTies: splitReview.consequentialTies, matches: [...finals.nightOne, ...finals.nightTwo], results: state.leagueFinalsResults ?? [], completedNights: state.completedFinalsNights ?? [], champions: finals.champions, directMovements: finals.directMovements, hasAuthoritativeClosingSchedule: false, manualReviews: state.manualReviews });
    const seeds = assignContinuitySeeds(splitReview.finalRegularStandings, transition.leagueComposition);
    return { transition, seeds };
  }, [props, state.completedFinalsNights, state.leagueFinalsResults, state.manualReviews]);
  const targetSplit: SplitName = props.split === "Opening Split" ? "Closing Split" : "Opening Split";
  const targetYear = props.split === "Opening Split" ? props.leagueYear : props.leagueYear + 1;
  const yearWeekStart = targetSplit === "Closing Split" ? 25 : 1;
  const rosters = Object.fromEntries(LEAGUE_NAMES.map((league) => [league, readiness.seeds.seeds[league].map((row) => row.wrestler)])) as Record<(typeof LEAGUE_NAMES)[number], string[]>;
  const validation = validateSchedule(preview, { rosters, lockedYearWeeks: state.completedWeeks.map((week) => week.week) });

  const generate = () => {
    setPreview(generateSchedule({ leagueYear: targetYear, split: targetSplit, yearWeekStart, seeds: readiness.seeds.seeds }));
    setMessage(null);
  };
  const importJson = () => {
    const imported = importScheduleJson(importText, { rosters, lockedYearWeeks: state.completedWeeks.map((week) => week.week) });
    setPreview(imported.matches);
    setMessage(imported.validation.valid ? null : { tone: "error", text: imported.validation.errors[0] ?? "Imported schedule requires review." });
  };
  const transitionValid = readiness.transition.unlocked && readiness.transition.compositionValid;
  const hasBlockingManualReview = (state.manualReviews ?? []).some((review) => review.status === "open");
  const acceptance = getScheduleAcceptanceStatus({
    transitionReady: transitionValid,
    seedsReady: readiness.seeds.valid,
    preview,
    validation,
    hasBlockingManualReview,
    hasAcceptedSnapshot: Boolean(state.acceptedSchedule),
    replaceConfirmed,
  });
  const accept = () => {
    if (!acceptance.enabled) {
      setMessage({ tone: "error", text: acceptance.disabledReason ?? "Schedule snapshot cannot be accepted." });
      return;
    }
    const acceptedSchedule = createAcceptedScheduleSnapshot({ preview, validation, leagueYear: targetYear, split: targetSplit });
    updateState((current) => ({ ...current, acceptedSchedule }));
    setReplaceConfirmed(false);
    setMessage({ tone: "success", text: "Schedule snapshot accepted. Week 25 / Closing Split activation is now available." });
  };
  const exportJson = () => { const blob = new Blob([JSON.stringify({ matches: preview }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `league-year-${targetYear}-${targetSplit.toLowerCase().replaceAll(" ", "-")}-schedule.json`; link.click(); URL.revokeObjectURL(link.href); };
  if (!hydrated) return <p>Loading schedule readiness…</p>;
  const unlocked = canActivateNextWeek({ transitionValid, seedsValid: readiness.seeds.valid, acceptedSchedule: state.acceptedSchedule, target: targetSplit === "Closing Split" ? "Closing Split Week 1" : "New League Year Week 1", hasOpenManualReviews: hasBlockingManualReview });

  return <div className="space-y-8">
    <section className="grid gap-4 md:grid-cols-3">{[["Phase 9B transition", transitionValid], ["Phase 9.5 seeds", readiness.seeds.valid], [targetSplit === "Closing Split" ? "Week 25 activation" : "New Year Week 1 activation", unlocked]].map(([label, valid]) => <div key={String(label)} className={`border p-5 ${valid ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}><p className="text-xs font-black uppercase">{label}</p><strong className="mt-2 block">{valid ? "Ready" : "Blocked"}</strong></div>)}</section>
    <section className="border border-white/10 bg-[#111722] p-6"><h2 className="text-xl font-black uppercase">Generate or import preview</h2><p className="mt-2 text-sm text-slate-400">Target: League Year {targetYear} · {targetSplit} · Year Weeks {yearWeekStart}–{yearWeekStart + 21}. Previews are not authoritative until explicitly accepted.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Status label="Preview status" value={preview.length ? `${preview[0].source} · ${preview.length} matches` : "No preview — generate or import schedule first."} ready={preview.length > 0} /><Status label="Validation status" value={preview.length ? validation.status : "Not run"} ready={validation.valid} /><Status label="Accepted snapshot status" value={state.acceptedSchedule ? "Accepted and persisted" : "Not accepted"} ready={Boolean(state.acceptedSchedule)} /></div><div className="mt-5 flex flex-wrap items-center gap-3"><button className="cursor-pointer bg-red-500 px-4 py-2 font-black uppercase disabled:cursor-not-allowed disabled:opacity-40" disabled={!transitionValid || !readiness.seeds.valid} onClick={generate}>Generate deterministic schedule</button><button className="cursor-pointer border border-white/20 px-4 py-2 font-bold disabled:cursor-not-allowed" disabled={!preview.length} onClick={exportJson}>Export JSON</button><button className="cursor-pointer border border-emerald-400/50 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40" disabled={!acceptance.enabled} onClick={accept}>Accept / promote snapshot</button>{state.acceptedSchedule && <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-200"><input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} /> Explicitly replace existing accepted snapshot</label>}</div>{acceptance.disabledReason && <p className="mt-3 text-sm font-bold text-amber-200" role="status">{acceptance.disabledReason}</p>}<textarea aria-label="Imported schedule JSON" className="mt-5 h-36 w-full border border-white/10 bg-black/30 p-3 font-mono text-xs" placeholder="Paste generated schedule JSON" value={importText} onChange={(event) => setImportText(event.target.value)} /><button className="mt-2 cursor-pointer border border-white/20 px-4 py-2 font-bold" onClick={importJson}>Import JSON preview</button></section>
    <section className={`border p-6 ${validation.valid ? "border-emerald-400/30" : "border-amber-400/30"}`}><h2 className="text-xl font-black uppercase">Validation · {preview.length ? validation.status : "No preview"}</h2><p className="mt-2 text-sm">{validation.totalMatches} / 528 matches</p>{validation.errors.length > 0 && <ul className="mt-4 max-h-60 list-disc overflow-auto pl-5 text-sm text-amber-200">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</section>
    {message && <section role={message.tone === "error" ? "alert" : "status"} className={`border p-5 ${message.tone === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-amber-400/40 bg-amber-400/10 text-amber-100"}`}><strong>{message.text}</strong></section>}
    {state.acceptedSchedule && <section className="border border-emerald-400/30 bg-emerald-400/10 p-6"><h2 className="text-xl font-black uppercase">Accepted snapshot</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Metadata label="acceptedAt" value={state.acceptedSchedule.acceptedAt} /><Metadata label="leagueYear" value={String(state.acceptedSchedule.leagueYear)} /><Metadata label="split" value={state.acceptedSchedule.split} /><Metadata label="matchCount" value={String(state.acceptedSchedule.matches.length)} /><Metadata label="validationStatus" value={state.acceptedSchedule.validation.status} /><Metadata label="source" value={state.acceptedSchedule.source} />{state.acceptedSchedule.generatorVersion && <Metadata label="generatorVersion" value={state.acceptedSchedule.generatorVersion} />}{state.acceptedSchedule.importerVersion && <Metadata label="importerVersion" value={state.acceptedSchedule.importerVersion} />}</dl><p className="mt-4 text-sm text-emerald-100">This persisted snapshot is authoritative for activation. Starting the week still requires an explicit action.</p></section>}
    {preview.length > 0 && <section className="border border-white/10 bg-[#111722] p-6"><h2 className="text-xl font-black uppercase">Per-league / per-week audit</h2><div className="mt-5 grid gap-5 xl:grid-cols-4">{LEAGUE_NAMES.map((league) => <div key={league}><h3 className="font-black uppercase">{league}</h3>{Array.from({ length: 22 }, (_, i) => i + 1).map((week) => <details key={week} className="mt-2 border border-white/10 p-2"><summary className="cursor-pointer text-sm font-bold">Week {week} · {preview.filter((row) => row.league === league && row.splitWeek === week).length} matches</summary><ul className="mt-2 text-xs text-slate-300">{preview.filter((row) => row.league === league && row.splitWeek === week).map((row) => <li key={row.id}>{row.wrestlerA} vs {row.wrestlerB}</li>)}</ul></details>)}</div>)}</div></section>}
  </div>;
}

function Status({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className={`border p-3 ${ready ? "border-emerald-400/30" : "border-white/10"}`}><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words font-bold">{value}</dd></div>;
}
