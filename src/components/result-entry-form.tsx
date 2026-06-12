"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
confirmResult,
isWeekLocked,
removeResult,
upsertResult,
type ConfirmedResultType,
} from "@/domain/tracker-state";
import type { LeagueName, Match } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

export function ResultEntryForm({
matches,
userLeague,
}: {
matches: Match[];
userLeague: LeagueName;
}) {
const { state, replaceState, hydrated } = useTrackerState();
const [matchId, setMatchId] = useState(matches[0]?.id ?? "");

const selected = useMemo(
() => matches.find((match) => match.id === matchId),
[matchId, matches],
);

const existing = state.confirmedResults.find(
(result) => result.matchId === matchId,
);

const [resultType, setResultType] =
useState<ConfirmedResultType>("Winner");
const [winner, setWinner] = useState(matches[0]?.wrestlerA ?? "");
const [dirty, setDirty] = useState(false);

const effectiveResultType = dirty
? resultType
: existing?.resultType ?? resultType;

const effectiveWinner = dirty
? winner
: existing?.winner ?? winner;

const [message, setMessage] = useState<{
tone: "success" | "error";
text: string;
} | null>(null);

const weekLocked = selected ? isWeekLocked(state, selected.week) : false;

function chooseMatch(id: string) {
setMatchId(id);

```
const match = matches.find((candidate) => candidate.id === id);
const confirmed = state.confirmedResults.find(
  (result) => result.matchId === id,
);

setResultType(confirmed?.resultType ?? "Winner");
setWinner(confirmed?.winner ?? match?.wrestlerA ?? "");
setDirty(false);
setMessage(null);
```

}

function submit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

```
if (!selected) return;

const confirmed = {
  league: selected.league,
  week: selected.week,
  matchId: selected.id,
  wrestlerA: selected.wrestlerA,
  wrestlerB: selected.wrestlerB,
  resultType: effectiveResultType,
  winner: effectiveResultType === "Winner" ? effectiveWinner : null,
  source: "Manual" as const,
  confirmedAt: new Date().toISOString(),
};

const action = existing
  ? upsertResult(state, confirmed, matches, userLeague)
  : confirmResult(state, confirmed, matches, userLeague);

if (!action.ok) {
  setMessage({ tone: "error", text: action.errors.join(" ") });
  return;
}

replaceState(action.state);
setDirty(false);
setMessage({
  tone: "success",
  text: `${existing ? "Updated" : "Confirmed"}: ${selected.wrestlerA} vs ${selected.wrestlerB}. Stored in local app state only.`,
});
```

}

function remove() {
if (!existing) return;

```
const action = removeResult(state, existing.matchId);

if (!action.ok) {
  setMessage({ tone: "error", text: action.errors.join(" ") });
  return;
}

replaceState(action.state);
setResultType("Winner");
setWinner(selected?.wrestlerA ?? "");
setDirty(false);
setMessage({
  tone: "success",
  text: "Confirmed result removed from local app state.",
});
```

}

if (!hydrated) {
return ( <div className="p-6 text-sm text-slate-500">
Loading local tracker state… </div>
);
}

return ( <form onSubmit={submit} className="grid gap-5 p-6">
{weekLocked && ( <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
Week {selected?.week} is complete and locked. Unlock it from Week Review before editing. </div>
)}

```
  <div>
    <label
      className="mb-2 block text-[11px] font-bold uppercase tracking-[.16em] text-slate-500"
      htmlFor="match"
    >
      Scheduled matchup
    </label>
    <select
      id="match"
      value={matchId}
      onChange={(event) => chooseMatch(event.target.value)}
      className="w-full border border-white/15 bg-[#0b1019] px-4 py-3 text-white outline-none focus:border-red-400"
    >
      {matches.map((match) => (
        <option value={match.id} key={match.id}>
          Match {match.matchNumber}: {match.wrestlerA} vs {match.wrestlerB}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label
      className="mb-2 block text-[11px] font-bold uppercase tracking-[.16em] text-slate-500"
      htmlFor="result-type"
    >
      Result type
    </label>
    <select
      id="result-type"
      value={effectiveResultType}
      disabled={weekLocked}
      onChange={(event) => {
        setResultType(event.target.value as ConfirmedResultType);
        setDirty(true);
      }}
      className="w-full border border-white/15 bg-[#0b1019] px-4 py-3 text-white disabled:opacity-50"
    >
      <option>Winner</option>
      <option>Draw</option>
      <option>No Contest</option>
    </select>
  </div>

  {effectiveResultType === "Winner" && (
    <fieldset disabled={weekLocked}>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">
        Winner
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {selected &&
          [selected.wrestlerA, selected.wrestlerB].map((name) => (
            <label
              key={name}
              className={`cursor-pointer border p-4 font-bold transition ${
                effectiveWinner === name
                  ? "border-red-400 bg-red-400/10"
                  : "border-white/10 bg-white/[.02] hover:border-white/25"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="winner"
                value={name}
                checked={effectiveWinner === name}
                onChange={() => {
                  setWinner(name);
                  setDirty(true);
                }}
              />
              {name}
            </label>
          ))}
      </div>
    </fieldset>
  )}

  <div className="flex flex-wrap gap-3">
    <button
      disabled={weekLocked}
      className="bg-red-500 px-5 py-4 text-sm font-black uppercase tracking-[.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
      type="submit"
    >
      {existing ? "Update confirmed result" : "Confirm result"}
    </button>

    {existing && (
      <button
        disabled={weekLocked}
        onClick={remove}
        className="border border-white/15 px-5 py-4 text-sm font-black uppercase tracking-[.16em] text-slate-300 disabled:opacity-40"
        type="button"
      >
        Remove
      </button>
    )}
  </div>

  {existing && (
    <div className="border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-sky-200">
      Confirmed from {existing.source} at{" "}
      {new Date(existing.confirmedAt).toLocaleString()}.
    </div>
  )}

  {message && (
    <div
      role="status"
      className={`border p-4 text-sm ${
        message.tone === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/30 bg-red-400/10 text-red-200"
      }`}
    >
      {message.text}
    </div>
  )}
</form>
```

);
}
