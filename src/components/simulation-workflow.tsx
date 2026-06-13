"use client";

import { SimulationWorkbench } from "./simulation-workbench";
import { Panel, Stat } from "./ui";
import { buildSimulationCandidates } from "@/domain/simulation";
import { detectActiveWeek, getWeekProgress } from "@/domain/week-progression";
import type { League, LeagueName, Match, MatchResult, MatchupReferenceRow, StandingRow, StreakRecord } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface SimulationWorkflowProps {
  matches: Match[];
  matchupReference: MatchupReferenceRow[];
  leagues: League[];
  standings: StandingRow[];
  streaks: StreakRecord[];
  existingResults: MatchResult[];
  workbookCurrentWeek: number;
  userLeague: LeagueName;
  userWrestler: string;
}

export function SimulationWorkflow(props: SimulationWorkflowProps) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <div className="border border-white/10 p-6 text-sm text-slate-500">Loading local tracker state…</div>;

  const resolution = detectActiveWeek(state, props.matches, props.workbookCurrentWeek);
  const week = resolution.activeWeek;
  if (week === null) return <div className="border border-emerald-400/20 bg-emerald-400/5 p-10 text-center"><h2 className="text-2xl font-black uppercase">No active simulation week</h2><p className="mt-2 text-slate-400">Every authoritative scheduled week is locked in local tracker state.</p></div>;

  const simulation = buildSimulationCandidates({
    matches: props.matches,
    matchupReference: props.matchupReference,
    leagues: props.leagues,
    standings: props.standings,
    streaks: props.streaks,
    existingResults: props.existingResults,
    userLeague: props.userLeague,
    targetWeek: week,
    confirmedMatchIds: state.confirmedResults.map((result) => result.matchId),
  });
  const progress = getWeekProgress(state, week, props.matches, props.userLeague);
  const eligibleLeagues = [...new Set(simulation.candidates.map((candidate) => candidate.match.league))];

  return <>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Active simulation week" value={`Week ${week}`} detail={`${progress.simulation}/18 non-user results confirmed`} />
      <Stat label="Open simulation matches" value={simulation.candidates.length} detail={eligibleLeagues.join(" · ") || "All non-user matches confirmed"} />
      <Stat label="Excluded user league" value={props.userLeague.replace(" League", "")} detail={props.userWrestler} />
    </div>
    <Panel className="mb-8"><div className="grid gap-4 p-5 text-sm leading-6 text-slate-300 md:grid-cols-3"><div><p className="font-black uppercase text-white">Active week only</p><p className="text-slate-500">Candidates are limited to open Week {week} fixtures in Schedule_22W and Matchup_Reference.</p></div><div><p className="font-black uppercase text-white">Confirmed matches excluded</p><p className="text-slate-500">Browser-confirmed results are removed from the candidate list before generation.</p></div><div><p className="font-black uppercase text-white">User league protected</p><p className="text-slate-500">{props.userLeague} is never eligible for simulation.</p></div></div></Panel>
    {simulation.candidates.length === 0
      ? <div className="border border-white/10 bg-[#111722] p-10 text-center"><h2 className="text-2xl font-black uppercase">Simulation card complete</h2><p className="mt-2 text-slate-500">No open authoritative non-user matchups remain for Week {week}. Continue to Week Review.</p></div>
      : <SimulationWorkbench week={week} candidates={simulation.candidates} scheduledMatches={props.matches} existingResults={props.existingResults} userLeague={props.userLeague} />}
  </>;
}
