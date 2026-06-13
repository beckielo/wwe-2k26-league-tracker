"use client";

import { SimulationWorkbench } from "./simulation-workbench";
import { Panel, Stat } from "./ui";
import { WorkflowSummaryBanner } from "./workflow-summary-banner";
import { buildSimulationCandidates } from "@/domain/simulation";
import { getWorkflowSummary } from "@/domain/week-progression";
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

  const summary = getWorkflowSummary(state, props.matches, props.workbookCurrentWeek, props.userLeague);
  const week = summary.activeWeek;
  if (week === null) return <WorkflowSummaryBanner matches={props.matches} workbookCurrentWeek={props.workbookCurrentWeek} userLeague={props.userLeague} />;

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
  const eligibleLeagues = [...new Set(simulation.candidates.map((candidate) => candidate.match.league))];

  return <>
    <div className="mb-8">
      <WorkflowSummaryBanner matches={props.matches} workbookCurrentWeek={props.workbookCurrentWeek} userLeague={props.userLeague} compact />
    </div>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Active simulation week" value={`Week ${week}`} detail={`${summary.progress?.simulation ?? 0}/18 non-user results confirmed`} />
      <Stat label="Open simulation matches" value={simulation.candidates.length} detail={eligibleLeagues.join(" · ") || "All non-user matches confirmed"} />
      <Stat label="Excluded user league" value={props.userLeague.replace(" League", "")} detail={props.userWrestler} />
    </div>
    <div className="mb-8 grid gap-4 md:grid-cols-3">
      {summary.nonUserLeagueProgress.map((league) => (
        <div key={league.league} className="border border-white/10 bg-[#111722] p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Simulation league</p><h2 className="mt-2 text-lg font-black uppercase">{league.league}</h2></div>
            <span className={`border px-2 py-1 text-xs font-black ${league.missing ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{league.confirmed}/{league.scheduled}</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">{league.missing ? `${league.missing} authoritative matches still open.` : "League card complete in local state."}</p>
        </div>
      ))}
    </div>
    <Panel className="mb-8"><div className="grid gap-4 p-5 text-sm leading-6 text-slate-300 md:grid-cols-3"><div><p className="font-black uppercase text-white">Active week only</p><p className="text-slate-500">Candidates are limited to open Week {week} fixtures in Schedule_22W and Matchup_Reference.</p></div><div><p className="font-black uppercase text-white">Confirmed matches excluded</p><p className="text-slate-500">Browser-confirmed results are removed from the candidate list before generation.</p></div><div><p className="font-black uppercase text-white">User league protected</p><p className="text-slate-500">{props.userLeague} is never eligible for simulation.</p></div></div></Panel>
    {simulation.candidates.length === 0
      ? <div className="border border-white/10 bg-[#111722] p-10 text-center"><h2 className="text-2xl font-black uppercase">Simulation card complete</h2><p className="mt-2 text-slate-500">No open authoritative non-user matchups remain for Week {week}. Continue to Week Review.</p></div>
      : <SimulationWorkbench week={week} candidates={simulation.candidates} scheduledMatches={props.matches} existingResults={props.existingResults} userLeague={props.userLeague} />}
  </>;
}
