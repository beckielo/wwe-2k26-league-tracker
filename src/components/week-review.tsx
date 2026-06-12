"use client";

import { useMemo, useRef, useState } from "react";
import {
  calculateStandingsWithConfirmedResults,
  completeWeek,
  isWeekLocked,
  removeResult,
  unlockWeek,
  validateWeekCompletion,
} from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface WeekReviewProps {
  week: number;
  matches: Match[];
  allMatches: Match[];
  baselineStandings: StandingRow[];
  userLeague: LeagueName;
}

export function WeekReview({ week, matches, allMatches, baselineStandings, userLeague }: WeekReviewProps) {
  const { state, replaceState, exportState, importState, resetState, hydrated } = useTrackerState();
  const [messages, setMessages] = useState<string[]>([]);
  const importInput = useRef<HTMLInputElement>(null);
  const locked = isWeekLocked(state, week);
  const results = state.confirmedResults.filter((result) => result.week === week);
  const resultByMatch = new Map(results.map((result) => [result.matchId, result]));
  const userMatches = matches.filter((match) => match.league === userLeague);
  const simulationMatches = matches.filter((match) => match.league !== userLeague);
  const missing = matches.filter((match) => !resultByMatch.has(match.id));
  const validationWarnings = validateWeekCompletion(state, week, allMatches, userLeague);
  const updatedStandings = useMemo(
    () => calculateStandingsWithConfirmedResults(baselineStandings, allMatches, state.confirmedResults.filter((result) => result.week <= week)),
    [allMatches, baselineStandings, state.confirmedResults, week],
  );

  function markComplete() {
    const action = completeWeek(state, week, allMatches, userLeague);
    if (!action.ok) return setMessages(action.errors);
    replaceState(action.state);
    setMessages([]);
  }

  function unlock() {
    if (!window.confirm(`Unlock Week ${week}? Confirmed results will become editable again.`)) return;
    replaceState(unlockWeek(state, week));
    setMessages([`Week ${week} unlocked. Review changes carefully before completing it again.`]);
  }

  function remove(matchId: string) {
    const action = removeResult(state, matchId);
    if (!action.ok) return setMessages(action.errors);
    replaceState(action.state);
    setMessages([]);
  }

  function downloadExport() {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wwe-2k26-tracker-state-week-${week}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const errors = importState(await file.text(), allMatches, userLeague);
    setMessages(errors.length ? errors : ["Tracker state imported successfully. Review all results before continuing."]);
    if (importInput.current) importInput.current.value = "";
  }

  function reset() {
    if (!window.confirm("Reset all local tracker state? This removes confirmed results, completed-week locks, and import/export timestamps from this browser. The workbook is not affected.")) return;
    resetState();
    setMessages(["Local tracker state reset. The workbook snapshot remains unchanged."]);
  }

  if (!hydrated) return <div className="border border-white/10 p-6 text-sm text-slate-500">Loading local tracker state…</div>;

  const renderMatches = (title: string, items: Match[], source: "Manual" | "Simulation") => <section className="border border-white/10 bg-[#111722]/90">
    <div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">{source} results</p><h2 className="mt-1 text-xl font-black uppercase">{title}</h2></div><span className="text-xs text-slate-500">{items.filter((match) => resultByMatch.has(match.id)).length}/{items.length} confirmed</span></div>
    <div className="divide-y divide-white/10">{items.sort((a, b) => a.league.localeCompare(b.league) || a.matchNumber - b.matchNumber).map((match) => {
      const result = resultByMatch.get(match.id);
      return <div key={match.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-600">{match.league} · Match {match.matchNumber}</p><p className="mt-1 font-bold">{match.wrestlerA} vs {match.wrestlerB}</p><p className={`mt-1 text-sm ${result ? "text-emerald-300" : "text-amber-300"}`}>{result ? `${result.resultType === "Winner" ? `${result.winner} wins` : result.resultType} · ${result.source}` : "Missing confirmed result"}</p></div>{result && !locked && <button type="button" onClick={() => remove(match.id)} className="border border-white/15 px-3 py-2 text-xs font-black uppercase text-slate-400">Remove</button>}</div>;
    })}</div>
  </section>;

  return <div className="space-y-8">
    <div className="grid gap-4 sm:grid-cols-4"><div className="border border-white/10 bg-[#111722] p-5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Scheduled</p><p className="mt-2 text-3xl font-black">{matches.length}</p></div><div className="border border-white/10 bg-[#111722] p-5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Confirmed</p><p className="mt-2 text-3xl font-black text-emerald-300">{results.length}</p></div><div className="border border-white/10 bg-[#111722] p-5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Missing</p><p className="mt-2 text-3xl font-black text-amber-300">{missing.length}</p></div><div className="border border-white/10 bg-[#111722] p-5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Week state</p><p className="mt-2 text-2xl font-black">{locked ? "Locked" : "Open"}</p></div></div>

    {messages.length > 0 && <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><ul className="list-disc space-y-1 pl-5">{messages.map((message) => <li key={message}>{message}</li>)}</ul></div>}
    {validationWarnings.length > 0 && !locked && <div className="border border-amber-400/30 bg-amber-400/5 p-5"><p className="font-black uppercase text-amber-300">Completion validation</p><p className="mt-1 text-sm text-slate-400">{missing.length} results are still missing. Week {week} cannot be completed until all 24 scheduled matches have valid confirmed results.</p></div>}
    {locked && <div className="border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-200"><p className="font-black uppercase">Week {week} complete and locked</p><p className="mt-1 text-sm">Updated tables below are app-state calculations over the workbook baseline. The Excel file has not been mutated.</p></div>}

    <div className="grid gap-6 xl:grid-cols-2">{renderMatches(userLeague, userMatches, "Manual")}{renderMatches("Non-user leagues", simulationMatches, "Simulation")}</div>

    <div className="flex flex-wrap gap-3 border border-white/10 bg-[#111722] p-5">{locked ? <button onClick={unlock} className="border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-amber-300">Unlock week with warning</button> : <button disabled={validationWarnings.length > 0} onClick={markComplete} className="bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-35">Mark Week {week} complete</button>}<button onClick={downloadExport} className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">Export JSON</button><button onClick={() => importInput.current?.click()} className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">Import JSON</button><input ref={importInput} type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} className="hidden" /><button onClick={reset} className="ml-auto border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-red-300">Reset local tracker state</button></div>
    <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:justify-between"><span>Last export: {state.lastExportedAt ? new Date(state.lastExportedAt).toLocaleString() : "Never"}</span><span>Last import: {state.lastImportedAt ? new Date(state.lastImportedAt).toLocaleString() : "Never"}</span></div>

    {locked && <section className="border border-white/10 bg-[#111722]"><div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">App-state calculation</p><h2 className="mt-1 text-xl font-black uppercase">Updated standings after Week {week}</h2></div><div className="grid gap-px bg-white/10 xl:grid-cols-4">{[...new Set(updatedStandings.map((row) => row.league))].map((league) => <div key={league} className="bg-[#111722] p-4"><h3 className="mb-3 text-sm font-black uppercase">{league}</h3><ol className="space-y-2">{updatedStandings.filter((row) => row.league === league).map((row) => <li key={row.wrestler} className="flex justify-between text-xs"><span>#{row.rank} {row.wrestler}</span><strong>{row.points} pts</strong></li>)}</ol></div>)}</div></section>}
  </div>;
}
