"use client";

import { SimulationWorkbench } from "./simulation-workbench";
import { Stat } from "./ui";
import { WorkflowSummaryBanner } from "./workflow-summary-banner";
import { buildSimulationCandidates } from "@/domain/simulation";
import { getWorkflowSummary } from "@/domain/week-progression";
import {
LEAGUE_NAMES,
type League,
type LeagueName,
type Match,
type MatchResult,
type MatchupReferenceRow,
type StandingRow,
type StreakRecord,
} from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { useCurrentUser } from "./current-user-switcher";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { getWeekDisplay } from "@/domain/week-display";
import { reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";

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
const { state, authority, hydrated } = useTrackerState();
const selectedUser = useCurrentUser(props.standings).currentUser;

if (!hydrated) {
return ( <div className="border border-white/10 p-6 text-sm text-slate-500">
Loading local tracker state… </div>
);
}

const workflowMatches = getActiveWorkflowMatches(state, props.matches);
const workflowBaseline = authority.completedThroughYearWeek;
const workflowUserLeague = state.activeWorkflow?.userLeague ?? selectedUser?.league ?? props.userLeague;
const summary = getWorkflowSummary(
state,
workflowMatches,
workflowBaseline,
workflowUserLeague,
);

const week = summary.activeWeek;

if (week === null) {
return ( <WorkflowSummaryBanner
     matches={props.matches}
     workbookCurrentWeek={props.workbookCurrentWeek}
     userLeague={workflowUserLeague}
   />
);
}

const liveStandings = reconstructActiveSplitLiveStandings({
previousFinalStandings: props.standings,
postFinalsAssignments: state.activeWorkflow ? LEAGUE_NAMES.flatMap((league) => state.acceptedPostFinalsComposition?.rosters[league] ?? []) : undefined,
scheduledMatches: workflowMatches,
masterResults: props.existingResults,
localResults: state.confirmedResults,
split: authority.split,
completedThroughWeek: authority.completedThroughYearWeek,
baselineCompletedThroughYearWeek: props.workbookCurrentWeek,
activeLeagueYear: authority.leagueYear,
rosterReplacements: state.rosterReplacements,
}).standings;

const simulation = buildSimulationCandidates({
matches: workflowMatches,
matchupReference: props.matchupReference,
leagues: props.leagues,
standings: liveStandings,
streaks: props.streaks,
existingResults: props.existingResults,
userLeague: workflowUserLeague,
targetWeek: week,
confirmedMatchIds: state.confirmedResults.map((result) => result.matchId),
scheduleSource: state.activeWorkflow && state.acceptedSchedule ? "accepted-snapshot" : "workbook",
});
const display = getWeekDisplay(authority.leagueYear, week, authority.split);

const eligibleLeagues = [
...new Set(simulation.candidates.map((candidate) => candidate.match.league)),
];
const missingNonUserMatches = summary.nonUserLeagueProgress.reduce(
  (total, league) => total + league.missing,
  0,
);

return (
<> <div className="mb-8"> <WorkflowSummaryBanner
       matches={props.matches}
       workbookCurrentWeek={props.workbookCurrentWeek}
       userLeague={workflowUserLeague}
       compact
     /> </div>

  <div className="mb-8 grid gap-4 sm:grid-cols-3">
    <Stat
      label="Active simulation week"
      value={display.primary}
      detail={display.secondary}
    />
    <Stat
      label="Open simulation matches"
      value={simulation.candidates.length}
      detail={
        eligibleLeagues.join(" · ")
          || (missingNonUserMatches
            ? `${missingNonUserMatches} matches need prediction inputs`
            : "All non-user matches confirmed")
      }
    />
    <Stat
      label="Excluded user league"
      value={workflowUserLeague.replace(" League", "")}
      detail={props.userWrestler}
    />
  </div>

  <div className="mb-8 grid gap-4 md:grid-cols-3">
    {summary.nonUserLeagueProgress.map((league) => (
      <div
        key={league.league}
        className="border border-white/10 bg-[#111722] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
              Simulation league
            </p>
            <h2 className="mt-2 text-lg font-black uppercase">
              {league.league}
            </h2>
          </div>

          <span
            className={
              "border px-2 py-1 text-xs font-black " +
              (league.missing
                ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200")
            }
          >
            {league.confirmed}/{league.scheduled}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-400">
          {league.missing
            ? league.missing + " authoritative matches still open."
            : "League card complete in local state."}
        </p>
      </div>
    ))}
  </div>

  {simulation.candidates.length === 0 ? (
    <div className="border border-white/10 bg-[#111722] p-10 text-center">
      <h2 className="text-2xl font-black uppercase">
        {missingNonUserMatches ? "Prediction candidates unavailable" : "Simulation card complete"}
      </h2>
      <p className="mt-2 text-slate-500">
        {missingNonUserMatches
          ? `${missingNonUserMatches} authoritative non-user matches remain open, but no eligible weighted prediction candidate is available. Review the schedule and matchup reference before confirming results.`
          : `No open authoritative non-user matchups remain for ${display.primary}. Continue to Week Review.`}
      </p>
    </div>
  ) : (
    <SimulationWorkbench
      week={week}
      weekLabel={display.primary}
      candidates={simulation.candidates}
      scheduledMatches={workflowMatches}
      existingResults={props.existingResults}
      userLeague={workflowUserLeague}
    />
  )}
</>

);
}
