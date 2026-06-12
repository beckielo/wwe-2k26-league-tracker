"use client";

import { useEffect, useMemo, useState } from "react";
import {
  simulateMatches,
  validateSimulatedResults,
  type SimulationCandidate,
  type SimulationOutcome,
  type SimulationPreview,
} from "@/domain/simulation";
import type { LeagueName, Match, MatchResult } from "@/domain/types";

interface SimulationWorkbenchProps {
  week: number;
  candidates: SimulationCandidate[];
  scheduledMatches: Match[];
  existingResults: MatchResult[];
  userLeague: LeagueName;
}

function storageKey(week: number): string {
  return `wwe-2k26-simulation-preview-week-${week}`;
}

export function SimulationWorkbench({ week, candidates, scheduledMatches, existingResults, userLeague }: SimulationWorkbenchProps) {
  const [previews, setPreviews] = useState<SimulationPreview[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey(week));
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as SimulationPreview[];
        const validation = validateSimulatedResults({
          results: parsed.map(({ matchId, outcome, winner }) => ({ matchId, outcome, winner })),
          scheduledMatches,
          existingResults,
          userLeague,
        });
        if (!validation.valid) {
          window.localStorage.removeItem(storageKey(week));
          return;
        }
        setPreviews(parsed);
        setConfirmed(true);
      } catch {
        window.localStorage.removeItem(storageKey(week));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [existingResults, scheduledMatches, userLeague, week]);

  const leagues = useMemo(() => [...new Set(candidates.map((candidate) => candidate.match.league))], [candidates]);

  function generate() {
    setPreviews(simulateMatches(candidates));
    setConfirmed(false);
    setErrors([]);
  }

  function editResult(matchId: string, value: string) {
    setPreviews((current) => current.map((preview) => {
      if (preview.matchId !== matchId) return preview;
      const outcome: SimulationOutcome = value === "draw" ? "draw" : value === "no-contest" ? "no-contest" : "decisive";
      const winner = outcome === "decisive" ? value : null;
      return {
        ...preview,
        outcome,
        winner,
        upset: Boolean(winner && preview.favorite && winner !== preview.favorite),
        reason: outcome === "decisive"
          ? `Manually reviewed preview: ${winner} selected as winner. Original weighted favorite: ${preview.favorite ?? "none"}.`
          : `Manually reviewed preview: ${outcome === "draw" ? "Draw" : "No Contest"} selected; no winner assigned.`,
      };
    }));
    setConfirmed(false);
    setErrors([]);
  }

  function confirmPreview() {
    const validation = validateSimulatedResults({
      results: previews.map(({ matchId, outcome, winner }) => ({ matchId, outcome, winner })),
      scheduledMatches,
      existingResults,
      userLeague,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      setConfirmed(false);
      return;
    }
    window.localStorage.setItem(storageKey(week), JSON.stringify(previews));
    setErrors([]);
    setConfirmed(true);
  }

  function clearPreview() {
    window.localStorage.removeItem(storageKey(week));
    setPreviews([]);
    setConfirmed(false);
    setErrors([]);
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 border border-white/10 bg-[#111722] p-5 sm:flex-row sm:items-center">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-red-400">Simulation Week {week}</p><p className="mt-1 text-sm text-slate-400">{candidates.length} scheduled matches across {leagues.length} eligible leagues. {userLeague} is excluded.</p></div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={generate} className="bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-white hover:bg-red-400">{previews.length ? "Regenerate preview" : "Generate preview"}</button>
        {previews.length > 0 && <button type="button" onClick={confirmPreview} className="border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-emerald-300 hover:bg-emerald-400/20">Confirm locally</button>}
        {previews.length > 0 && <button type="button" onClick={clearPreview} className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-slate-400 hover:bg-white/5">Clear</button>}
      </div>
    </div>

    {confirmed && <div role="status" className="border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Confirmed in this browser only. The Excel workbook and server data remain unchanged.</div>}
    {errors.length > 0 && <div role="alert" className="border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p className="font-black uppercase">Preview validation failed</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

    {previews.length === 0 ? <div className="border border-dashed border-white/15 p-10 text-center"><p className="text-lg font-black uppercase">No generated results yet</p><p className="mt-2 text-sm text-slate-500">Generate a reviewable preview. Nothing is saved to the workbook.</p></div> : leagues.map((league) => <section key={league} className="border border-white/10 bg-[#111722]/90">
      <div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Editable preview</p><h2 className="mt-1 text-xl font-black uppercase">{league}</h2></div><span className="text-xs text-slate-500">{previews.filter((preview) => preview.league === league).length} matches</span></div>
      <div className="divide-y divide-white/10">{previews.filter((preview) => preview.league === league).sort((a, b) => a.matchNumber - b.matchNumber).map((preview) => <article key={preview.matchId} className="grid gap-5 p-5 lg:grid-cols-[1fr_15rem_1.2fr] lg:items-center">
        <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-600">Match {preview.matchNumber}</p><p className="mt-2 text-lg font-bold">{preview.wrestlerA} <span className="mx-2 text-xs italic text-red-400">VS</span> {preview.wrestlerB}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="border border-white/10 px-2 py-1 text-slate-400">{preview.favoriteLabel}</span>{preview.favorite && <span className="border border-sky-400/20 bg-sky-400/5 px-2 py-1 text-sky-300">Favorite: {preview.favorite} · {Math.round(preview.favoriteProbability * 100)}%</span>}{preview.upset && <span className="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-300">Upset warning</span>}</div></div>
        <div><label htmlFor={preview.matchId} className="mb-2 block text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Review result</label><select id={preview.matchId} value={preview.outcome === "decisive" ? preview.winner ?? "" : preview.outcome} onChange={(event) => editResult(preview.matchId, event.target.value)} className="w-full border border-white/15 bg-[#0b1019] px-3 py-3 text-sm font-bold text-white outline-none focus:border-red-400"><option value={preview.wrestlerA}>{preview.wrestlerA} wins</option><option value={preview.wrestlerB}>{preview.wrestlerB} wins</option><option value="draw">Draw</option><option value="no-contest">No Contest</option></select></div>
        <p className="text-sm leading-6 text-slate-400">{preview.reason}</p>
      </article>)}</div>
    </section>)}
  </div>;
}
