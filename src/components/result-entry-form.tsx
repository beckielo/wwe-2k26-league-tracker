"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/domain/types";
import { validateResultEntry } from "@/domain/validation";

export function ResultEntryForm({ matches }: { matches: Match[] }) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const selected = useMemo(() => matches.find((match) => match.id === matchId), [matchId, matches]);
  const [winner, setWinner] = useState(matches[0]?.wrestlerA ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function chooseMatch(id: string) {
    setMatchId(id);
    const match = matches.find((candidate) => candidate.id === id);
    setWinner(match?.wrestlerA ?? "");
    setMessage(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateResultEntry({ matchId, winner }, matches);
    if (!validation.valid) {
      setMessage({ tone: "error", text: validation.message });
      return;
    }
    setMessage({ tone: "success", text: `Validated: ${winner} def. ${validation.loser}. This Phase 1 preview does not write to the workbook.` });
  }

  return <form onSubmit={submit} className="grid gap-5 p-6">
    <div><label className="mb-2 block text-[11px] font-bold uppercase tracking-[.16em] text-slate-500" htmlFor="match">Scheduled matchup</label><select id="match" value={matchId} onChange={(event) => chooseMatch(event.target.value)} className="w-full border border-white/15 bg-[#0b1019] px-4 py-3 text-white outline-none focus:border-red-400">
      {matches.map((match) => <option value={match.id} key={match.id}>Match {match.matchNumber}: {match.wrestlerA} vs {match.wrestlerB}</option>)}
    </select></div>
    <fieldset><legend className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">Winner</legend><div className="grid gap-3 sm:grid-cols-2">{selected && [selected.wrestlerA, selected.wrestlerB].map((name) => <label key={name} className={`cursor-pointer border p-4 font-bold transition ${winner === name ? "border-red-400 bg-red-400/10" : "border-white/10 bg-white/[.02] hover:border-white/25"}`}><input className="sr-only" type="radio" name="winner" value={name} checked={winner === name} onChange={() => setWinner(name)} />{name}</label>)}</div></fieldset>
    <button className="mt-2 bg-red-500 px-5 py-4 text-sm font-black uppercase tracking-[.16em] text-white shadow-[5px_5px_0_#fff] transition hover:-translate-y-0.5" type="submit">Validate result</button>
    {message && <div role="status" className={`border p-4 text-sm ${message.tone === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>{message.text}</div>}
  </form>;
}
