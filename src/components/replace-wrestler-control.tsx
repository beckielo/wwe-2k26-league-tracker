"use client";

import { useMemo, useState } from "react";
import { isRosterReplacementWindow, replaceWrestler } from "@/domain/roster-replacement";
import { LEAGUE_NAMES, type LeagueName, type Match, type StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface ReplaceWrestlerControlProps {
  activeRoster: StandingRow[];
  matches: Match[];
  leagueYear: number;
  split: string;
  week: number;
}

export function ReplaceWrestlerControl({ activeRoster, matches, leagueYear, split, week }: ReplaceWrestlerControlProps) {
  const { state, updateState } = useTrackerState();
  const [open, setOpen] = useState(false);
  const [league, setLeague] = useState<LeagueName>(LEAGUE_NAMES[0]);
  const [oldWrestler, setOldWrestler] = useState("");
  const [newWrestler, setNewWrestler] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const status = isRosterReplacementWindow(state);
  const leagueRows = useMemo(() => activeRoster.filter((row) => row.league === league).sort((a, b) => a.rank - b.rank), [activeRoster, league]);
  const selectedOld = leagueRows.find((row) => row.wrestler === oldWrestler) ?? leagueRows[0] ?? null;

  function reset() {
    setOpen(false);
    setOldWrestler("");
    setNewWrestler("");
  }

  function confirm() {
    setMessage(null);
    const target = selectedOld?.wrestler ?? oldWrestler;
    let errors: string[] = [];
    updateState((current) => {
      const result = replaceWrestler({ state: current, activeRoster, matches, league, oldWrestler: target, newWrestler, leagueYear, split, week });
      errors = result.errors;
      return result.state;
    });
    if (errors.length) setMessage(errors.join(" "));
    else {
      setMessage(`Current User has been moved if needed. ${target} was replaced by ${newWrestler.trim().replace(/\s+/g, " ")}.`);
      reset();
    }
  }

  return <section className="management-card" aria-labelledby="replace-wrestler-title">
    <div>
      <p className="broadcast-kicker">Roster Management</p>
      <h2 id="replace-wrestler-title">Replace Wrestler</h2>
      <p>{status.unlocked ? status.reason : "Roster replacement unlocks after the first round or after League Finals."}</p>
    </div>
    <button className="action-button action-secondary" disabled={!status.unlocked} onClick={() => setOpen(true)}>Manual Draft</button>
    {!status.unlocked && <p className="text-xs text-amber-200" role="status">{status.reason}</p>}
    {message && <p className="text-xs text-emerald-200" role="status">{message}</p>}
    {open && status.unlocked && <div className="mt-4 grid gap-3 rounded border border-white/10 bg-black/20 p-4">
      <label className="grid gap-1 text-sm font-bold">Select League
        <select className="border border-white/10 bg-black/40 p-2" value={league} onChange={(event) => { setLeague(event.target.value as LeagueName); setOldWrestler(""); }}>
          {LEAGUE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold">Select wrestler / table position
        <select className="border border-white/10 bg-black/40 p-2" value={selectedOld?.wrestler ?? ""} onChange={(event) => setOldWrestler(event.target.value)}>
          {leagueRows.map((row) => <option key={row.wrestler} value={row.wrestler}>#{row.rank} {row.wrestler} · {row.points} pts</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold">New wrestler name
        <input className="border border-white/10 bg-black/40 p-2" value={newWrestler} onChange={(event) => setNewWrestler(event.target.value)} placeholder="Type new wrestler name" />
      </label>
      {selectedOld && newWrestler.trim() && <p className="rounded border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Replace {selectedOld.wrestler} with {newWrestler.trim().replace(/\s+/g, " ")} in {league}? The new wrestler starts from 0. Past results remain in history. Future matches will use the new wrestler.</p>}
      <div className="flex flex-wrap gap-2"><button className="action-button action-primary" onClick={confirm}>Confirm replacement</button><button className="action-button action-secondary" onClick={reset}>Cancel</button></div>
    </div>}
  </section>;
}
