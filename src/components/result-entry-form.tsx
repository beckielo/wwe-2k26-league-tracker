"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
confirmResult,
closeManualReview,
isWeekLocked,
markManualReview,
removeResult,
upsertResult,
type ConfirmedResultType,
} from "@/domain/tracker-state";
import type { LeagueName, Match } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface ResultEntryFormProps {
matches: Match[];
userLeague: LeagueName;
}

export function ResultEntryForm({ matches, userLeague }: ResultEntryFormProps) {
const { state, replaceState, hydrated } = useTrackerState();

const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
const [resultType, setResultType] =
useState<ConfirmedResultType>("Winner");
const [winner, setWinner] = useState(matches[0]?.wrestlerA ?? "");
const [dirty, setDirty] = useState(false);
const [message, setMessage] = useState<{
tone: "success" | "error";
text: string;
} | null>(null);
const [reviewNote, setReviewNote] = useState("");

const selected = useMemo(
() => matches.find((match) => match.id === matchId),
[matchId, matches],
);

const existing = state.confirmedResults.find(
(result) => result.matchId === matchId,
);

const effectiveResultType = dirty
? resultType
: existing?.resultType ?? resultType;

const effectiveWinner = dirty
? winner
: existing?.winner ?? winner;

const weekLocked = selected ? isWeekLocked(state, selected.week) : false;
const openReview = (state.manualReviews ?? []).find(
(review) => review.matchId === matchId && review.status === "open",
);

function chooseMatch(id: string) {
const match = matches.find((item) => item.id === id);
const confirmed = state.confirmedResults.find(
(result) => result.matchId === id,
);

setMatchId(id);
setResultType(confirmed?.resultType ?? "Winner");
setWinner(confirmed?.winner ?? match?.wrestlerA ?? "");
setDirty(false);
setMessage(null);

}

function submit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

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
  setMessage({
    tone: "error",
    text: action.errors.join(" "),
  });
  return;
}

replaceState(action.state);
setDirty(false);
setMessage({
  tone: "success",
  text:
    (existing ? "Updated" : "Confirmed") +
    ": " +
    selected.wrestlerA +
    " vs " +
    selected.wrestlerB +
    ". Stored in local app state only.",
});

}

function remove() {
if (!existing) return;

const action = removeResult(state, existing.matchId);

if (!action.ok) {
  setMessage({
    tone: "error",
    text: action.errors.join(" "),
  });
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

}

function createReview() {
if (!selected) return;
const action = markManualReview(state, {
scope: "regular",
matchId: selected.id,
league: selected.league,
weekOrEvent: `Week ${selected.week}`,
wrestlerA: selected.wrestlerA,
wrestlerB: selected.wrestlerB,
note: reviewNote,
});
if (!action.ok) return setMessage({ tone: "error", text: action.errors.join(" ") });
replaceState(action.state);
setReviewNote("");
setMessage({ tone: "success", text: "Manual Review opened. No result or finish type was assumed." });
}

function closeReview(status: "resolved" | "cleared") {
if (!openReview) return;
if (status === "resolved" && !existing) {
setMessage({ tone: "error", text: "Select and save a normal winner/loser before resolving this review." });
return;
}
const action = closeManualReview(state, openReview.id, status);
if (!action.ok) return setMessage({ tone: "error", text: action.errors.join(" ") });
replaceState(action.state);
setMessage({ tone: "success", text: status === "resolved" ? "Review resolved with the saved winner/loser." : "Review cleared; any valid saved result remains unchanged." });
}

if (!hydrated) {
return ( <div className="p-6 text-sm text-slate-500">
Loading local tracker state… </div>
);
}

return ( <form onSubmit={submit} className="grid gap-5 p-6">
{weekLocked && ( <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
Week {selected?.week} is complete and locked. Unlock it from Week
Review before editing. </div>
)}

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

  <p className="text-sm text-slate-400">Standard result entry records winner and loser only. No finish type or special outcome is assumed.</p>
  {
    <fieldset disabled={weekLocked}>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">
        Winner
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {selected &&
          [selected.wrestlerA, selected.wrestlerB].map((name) => (
            <ResultOption
              key={name}
              value={name}
              checked={effectiveResultType === "Winner" && effectiveWinner === name}
              onChange={() => {
                setResultType("Winner");
                setWinner(name);
                setDirty(true);
              }}
            >
              {name}
            </ResultOption>
          ))}
        <ResultOption
          value="Draw"
          checked={effectiveResultType === "Draw"}
          onChange={() => {
            setResultType("Draw");
            setWinner("");
            setDirty(true);
          }}
        >
          Draw
        </ResultOption>
        <ResultOption
          value="No Contest"
          checked={effectiveResultType === "No Contest"}
          onChange={() => {
            setResultType("No Contest");
            setWinner("");
            setDirty(true);
          }}
        >
          No Contest
        </ResultOption>
      </div>
    </fieldset>
  }

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
      Confirmed {existing.resultType === "Winner" ? `${existing.winner} wins` : existing.resultType} from {existing.source} at{" "}
      {new Date(existing.confirmedAt).toLocaleString()}.
    </div>
  )}

  <div className="border-t border-white/10 pt-5">
    {openReview ? (
      <div className="border border-amber-400/30 bg-amber-400/10 p-4">
        <p className="text-xs font-black uppercase tracking-wider text-amber-300">Manual Review / Unclear Result</p>
        <p className="mt-2 text-sm text-slate-200">{openReview.note}</p>
        <p className="mt-1 text-xs text-slate-500">Opened {new Date(openReview.createdAt).toLocaleString()}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={weekLocked || !existing} onClick={() => closeReview("resolved")} className="bg-emerald-500 px-3 py-2 text-xs font-black uppercase disabled:opacity-40">Resolve with Winner/Loser</button>
          <button type="button" disabled={weekLocked} onClick={() => closeReview("cleared")} className="border border-white/20 px-3 py-2 text-xs font-black uppercase disabled:opacity-40">Clear Review</button>
        </div>
      </div>
    ) : (
      <details>
        <summary className="cursor-pointer text-sm font-bold text-amber-300">Mark as Manual Review</summary>
        <label htmlFor="review-note" className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Review note</label>
        <textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-2 min-h-24 w-full border border-white/15 bg-[#0b1019] p-3" placeholder="Describe only what was observed or why a user decision is needed." />
        <button type="button" disabled={weekLocked || !reviewNote.trim()} onClick={createReview} className="mt-3 border border-amber-400/40 px-4 py-2 text-xs font-black uppercase text-amber-200 disabled:opacity-40">Mark as Manual Review</button>
      </details>
    )}
  </div>

  {message && (
    <div
      role={message.tone === "success" ? "status" : "alert"}
      className={
        "border p-4 text-sm " +
        (message.tone === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/30 bg-red-400/10 text-red-200")
      }
    >
      {message.text}
    </div>
  )}
</form>

);
}


function ResultOption({ value, checked, onChange, children }: { value: string; checked: boolean; onChange: () => void; children: ReactNode }) {
return (
  <label
    className={
      "flex min-h-16 cursor-pointer items-center rounded-lg border p-4 font-bold transition " +
      (checked
        ? "border-red-400 bg-red-400/10 text-white"
        : "border-white/10 bg-white/[.02] text-slate-100 hover:border-white/25")
    }
  >
    <input
      className="sr-only"
      type="radio"
      name="winner"
      value={value}
      checked={checked}
      onChange={onChange}
    />
    {children}
  </label>
);
}
