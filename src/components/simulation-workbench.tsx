"use client";

import { useMemo, useState } from "react";
import {
simulateMatches,
validateSimulatedResults,
type SimulationCandidate,
type SimulationOutcome,
type SimulationPreview,
} from "@/domain/simulation";
import { confirmResult, isWeekLocked, removeResult } from "@/domain/tracker-state";
import type { LeagueName, Match, MatchResult } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface SimulationWorkbenchProps {
week: number;
candidates: SimulationCandidate[];
scheduledMatches: Match[];
existingResults: MatchResult[];
userLeague: LeagueName;
}

export function SimulationWorkbench({
week,
candidates,
scheduledMatches,
existingResults,
userLeague,
}: SimulationWorkbenchProps) {
const { state, replaceState, hydrated } = useTrackerState();
const [previews, setPreviews] = useState<SimulationPreview[]>([]);
const [errors, setErrors] = useState<string[]>([]);

const confirmedForWeek = state.confirmedResults.filter(
(result) => result.week === week && result.source === "Simulation",
);

const confirmedIds = new Set(
state.confirmedResults.map((result) => result.matchId),
);

const availableCandidates = candidates.filter(
(candidate) => !confirmedIds.has(candidate.match.id),
);

const leagues = useMemo(
() => [...new Set(candidates.map((candidate) => candidate.match.league))],
[candidates],
);

const weekLocked = isWeekLocked(state, week);

function generate() {
setPreviews(simulateMatches(availableCandidates));
setErrors([]);
}

function editResult(matchId: string, value: string) {
setPreviews((current) =>
current.map((preview) => {
if (preview.matchId !== matchId) return preview;

    const outcome: SimulationOutcome =
      value === "draw"
        ? "draw"
        : value === "no-contest"
          ? "no-contest"
          : "decisive";

    const winner = outcome === "decisive" ? value : null;

    const reason =
      outcome === "decisive"
        ? "Manually reviewed preview: " +
          winner +
          " selected as winner. Original weighted favorite: " +
          (preview.favorite ?? "none") +
          "."
        : "Manually reviewed preview: " +
          (outcome === "draw" ? "Draw" : "No Contest") +
          " selected; no winner assigned.";

    return {
      ...preview,
      outcome,
      winner,
      upset: Boolean(winner && preview.favorite && winner !== preview.favorite),
      reason,
    };
  }),
);

setErrors([]);

}

function confirmPreview() {
const previewValidation = validateSimulatedResults({
results: previews.map(({ matchId, outcome, winner }) => ({
matchId,
outcome,
winner,
})),
scheduledMatches,
existingResults,
userLeague,
});

if (!previewValidation.valid) {
  setErrors(previewValidation.errors);
  return;
}

let nextState = state;
const actionErrors: string[] = [];

for (const preview of previews) {
  const match = scheduledMatches.find(
    (scheduledMatch) => scheduledMatch.id === preview.matchId,
  );

  if (!match) continue;

  const action = confirmResult(
    nextState,
    {
      league: match.league,
      week: match.week,
      matchId: match.id,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      resultType:
        preview.outcome === "decisive"
          ? "Winner"
          : preview.outcome === "draw"
            ? "Draw"
            : "No Contest",
      winner: preview.winner,
      source: "Simulation",
      confirmedAt: new Date().toISOString(),
    },
    scheduledMatches,
    userLeague,
  );

  if (!action.ok) {
    actionErrors.push(...action.errors);
  } else {
    nextState = action.state;
  }
}

if (actionErrors.length) {
  setErrors(actionErrors);
  return;
}

replaceState(nextState);
setPreviews([]);
setErrors([]);

}

function removeConfirmed(matchId: string) {
const action = removeResult(state, matchId);

if (!action.ok) {
  setErrors(action.errors);
  return;
}

replaceState(action.state);
setErrors([]);

}

if (!hydrated) {
return ( <div className="border border-white/10 p-6 text-sm text-slate-500">
Loading local tracker state… </div>
);
}

return ( <div className="space-y-6"> <div className="flex flex-col justify-between gap-4 border border-white/10 bg-[#111722] p-5 sm:flex-row sm:items-center"> <div> <p className="text-xs font-bold uppercase tracking-[.18em] text-red-400">
Simulation Week {week} </p> <p className="mt-1 text-sm text-slate-400">
{availableCandidates.length} unconfirmed scheduled matches across{" "}
{leagues.length} eligible leagues. {userLeague} is excluded. </p> </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={weekLocked || availableCandidates.length === 0}
        onClick={generate}
        className="bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-white disabled:opacity-40"
      >
        {previews.length ? "Regenerate preview" : "Generate preview"}
      </button>

      {previews.length > 0 && (
        <button
          type="button"
          disabled={weekLocked}
          onClick={confirmPreview}
          className="border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-emerald-300 disabled:opacity-40"
        >
          Confirm results
        </button>
      )}

      {previews.length > 0 && (
        <button
          type="button"
          onClick={() => setPreviews([])}
          className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-slate-400"
        >
          Clear preview
        </button>
      )}
    </div>
  </div>

  {weekLocked && (
    <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
      Week {week} is complete and locked. Unlock it in Week Review before changing confirmed simulations.
    </div>
  )}

  {errors.length > 0 && (
    <div
      role="alert"
      className="border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
    >
      <p className="font-black uppercase">Validation failed</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )}

  {confirmedForWeek.length > 0 && (
    <section className="border border-emerald-400/20 bg-emerald-400/5">
      <div className="border-b border-emerald-400/20 p-5">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-400">
          Confirmed simulation results
        </p>
        <h2 className="mt-1 text-xl font-black uppercase">
          Stored in shared tracker state
        </h2>
      </div>

      <div className="divide-y divide-white/10">
        {confirmedForWeek.map((result) => (
          <div
            key={result.matchId}
            className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
          >
            <span className="font-bold">
              {result.wrestlerA} vs {result.wrestlerB}:{" "}
              {result.resultType === "Winner"
                ? result.winner + " wins"
                : result.resultType}
            </span>

            <button
              type="button"
              disabled={weekLocked}
              onClick={() => removeConfirmed(result.matchId)}
              className="border border-white/15 px-3 py-2 text-xs font-black uppercase text-slate-300 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  )}

  {previews.length === 0 ? (
    <div className="border border-dashed border-white/15 p-10 text-center">
      <p className="text-lg font-black uppercase">
        {availableCandidates.length
          ? "No generated results yet"
          : "All eligible matches confirmed"}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Generated previews are editable before they enter shared tracker state.
      </p>
    </div>
  ) : (
    leagues.map((league) => (
      <section key={league} className="border border-white/10 bg-[#111722]/90">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">
              Editable preview
            </p>
            <h2 className="mt-1 text-xl font-black uppercase">{league}</h2>
          </div>
          <span className="text-xs text-slate-500">
            {previews.filter((preview) => preview.league === league).length} matches
          </span>
        </div>

        <div className="divide-y divide-white/10">
          {previews
            .filter((preview) => preview.league === league)
            .sort((a, b) => a.matchNumber - b.matchNumber)
            .map((preview) => (
              <article
                key={preview.matchId}
                className="grid gap-5 p-5 lg:grid-cols-[1fr_15rem_1.2fr] lg:items-center"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-600">
                    Match {preview.matchNumber}
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    {preview.wrestlerA}
                    <span className="mx-2 text-xs italic text-red-400">VS</span>
                    {preview.wrestlerB}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                    <span className="border border-white/10 px-2 py-1 text-slate-400">
                      {preview.favoriteLabel}
                    </span>
                    {preview.favorite && (
                      <span className="border border-sky-400/20 bg-sky-400/5 px-2 py-1 text-sky-300">
                        Favorite: {preview.favorite} ·{" "}
                        {Math.round(preview.favoriteProbability * 100)}%
                      </span>
                    )}
                    {preview.upset && (
                      <span className="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-300">
                        Upset warning
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={preview.matchId}
                    className="mb-2 block text-[10px] font-black uppercase tracking-[.15em] text-slate-500"
                  >
                    Review result
                  </label>
                  <select
                    id={preview.matchId}
                    value={
                      preview.outcome === "decisive"
                        ? preview.winner ?? ""
                        : preview.outcome
                    }
                    onChange={(event) => editResult(preview.matchId, event.target.value)}
                    className="w-full border border-white/15 bg-[#0b1019] px-3 py-3 text-sm font-bold text-white"
                  >
                    <option value={preview.wrestlerA}>
                      {preview.wrestlerA} wins
                    </option>
                    <option value={preview.wrestlerB}>
                      {preview.wrestlerB} wins
                    </option>
                    <option value="draw">Draw</option>
                    <option value="no-contest">No Contest</option>
                  </select>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  {preview.reason}
                </p>
              </article>
            ))}
        </div>
      </section>
    ))
  )}
</div>

);
}