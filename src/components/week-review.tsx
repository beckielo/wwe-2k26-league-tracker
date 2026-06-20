"use client";

import Link from "next/link";
import { useRef, useState, type RefObject } from "react";
import { WorkflowSummaryBanner } from "./workflow-summary-banner";
import { PromoteCurrentMaster } from "./promote-current-master";
import {
reconstructActiveSplitLiveStandings,
completeWeek,
unlockWeek,
} from "@/domain/tracker-state";
import { getWorkflowSummary } from "@/domain/week-progression";
import { deriveSplitCompletionReview } from "@/domain/split-completion";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type MatchupReferenceRow, type SplitName, type StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { placementLabel, placementZone } from "@/domain/visual-identity";
import { getPreviousSplitChampionColorRoles, type PreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import type { LegacyCompletedSplitAudit } from "@/domain/legacy";
import { WrestlerNameWithRole } from "./wrestler-name-with-role";

interface WeekReviewProps {
allMatches: Match[];
baselineStandings: StandingRow[];
workbookResults: MatchResult[];
matchupReference: MatchupReferenceRow[];
leagueYear: number;
split: SplitName;
hasLeagueFinalsTemplate: boolean;
userLeague: LeagueName;
workbookCurrentWeek: number;
originalWorkbookCurrentWeek: number;
latestAppWritebackWeek: number | null;
sourceFile: string;
userWrestler: string;
completedSplitAudit?: LegacyCompletedSplitAudit;
}

export function WeekReview({
allMatches,
baselineStandings,
workbookResults,
matchupReference,
leagueYear,
split,
hasLeagueFinalsTemplate,
userLeague,
workbookCurrentWeek,
originalWorkbookCurrentWeek,
latestAppWritebackWeek,
sourceFile,
userWrestler,
completedSplitAudit,
}: WeekReviewProps) {
const { state, replaceState, exportState, importState, resetState, hydrated } =
useTrackerState();

const [messages, setMessages] = useState<string[]>([]);
const importInput = useRef<HTMLInputElement>(null);
const workflowMatches = getActiveWorkflowMatches(state, allMatches);
const workflowBaseline = state.activeWorkflow ? (state.activeWorkflow.split === "Closing Split" ? 24 : 0) : workbookCurrentWeek;
const workflowUserLeague = state.activeWorkflow?.userLeague ?? userLeague;

const summary = getWorkflowSummary(
state,
workflowMatches,
workflowBaseline,
workflowUserLeague,
);

const week = summary.activeWeek;
const progress = summary.progress;

const latestLockedWeek = summary.latestLockedWeek;

const activeSplit = state.activeWorkflow?.split ?? split;
const miniStandingsCompletedThroughWeek = latestLockedWeek ?? workbookCurrentWeek;
const activeSplitWeek = activeSplit === "Closing Split" ? Math.max(1, miniStandingsCompletedThroughWeek - 24) : miniStandingsCompletedThroughWeek;
const liveStandings = reconstructActiveSplitLiveStandings({
previousFinalStandings: baselineStandings,
scheduledMatches: workflowMatches,
masterResults: workbookResults,
localResults: state.confirmedResults.filter((result) => result.week <= miniStandingsCompletedThroughWeek),
split: activeSplit,
completedThroughWeek: miniStandingsCompletedThroughWeek,
});
const updatedStandings = liveStandings.standings;
const localMatchResults = state.confirmedResults.map((result): MatchResult => {
const match = workflowMatches.find((candidate) => candidate.id === result.matchId);
const loser = result.resultType === "Winner" && result.winner && match
? (result.winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA)
: null;
return {
matchId: result.matchId,
outcome: result.resultType === "Winner" ? "decisive" : result.resultType === "Draw" ? "draw" : "no-contest",
winner: result.winner,
loser,
resultSource: result.source,
notes: null,
source: { file: "browser-local tracker state", sheet: "confirmedResults" },
};
});
const localResultIds = new Set(localMatchResults.map((result) => result.matchId));
const splitReview = deriveSplitCompletionReview({
leagueYear,
split,
completedThroughWeek: Math.max(workbookCurrentWeek, latestLockedWeek ?? 0),
standings: updatedStandings,
matches: allMatches,
results: [
...workbookResults.filter((result) => !localResultIds.has(result.matchId)),
...localMatchResults,
],
matchupReference,
hasLeagueFinalsTemplate,
});

function markComplete() {
if (week === null) return;

const action = completeWeek(state, week, workflowMatches, workflowUserLeague);

if (!action.ok) {
  setMessages(action.errors);
  return;
}

replaceState(action.state);
setMessages([
  "Week " +
    week +
    " completed and locked. The next authoritative scheduled week is now the workflow target.",
]);

}

function unlock(lockedWeek: number) {
const confirmed = window.confirm(
"Unlock Week " +
lockedWeek +
"? This returns it to the active workflow and makes its confirmed results editable again.",
);

if (!confirmed) return;

replaceState(unlockWeek(state, lockedWeek));
setMessages([
  "Week " +
    lockedWeek +
    " unlocked. Review changes carefully before locking it again.",
]);

}


function downloadExport() {
const json = exportState();
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");

anchor.href = url;
anchor.download =
  "wwe-2k26-tracker-state" +
  (week === null ? "" : "-week-" + week) +
  ".json";

anchor.click();
URL.revokeObjectURL(url);

}

async function importFile(file: File | undefined) {
if (!file) return;

const errors = importState(await file.text(), workflowMatches, workflowUserLeague);

setMessages(
  errors.length
    ? errors
    : [
        "Tracker state imported successfully. Review the active week before continuing.",
      ],
);

if (importInput.current) {
  importInput.current.value = "";
}

}

function reset() {
const confirmed = window.confirm(
"Reset all local tracker state? This removes confirmed results, completed-week locks, and import/export timestamps from this browser. The workbook is not affected.",
);

if (!confirmed) return;

resetState();
setMessages([
  "Local tracker state reset. The workbook snapshot remains unchanged.",
]);

}

if (!hydrated) {
return ( <div className="border border-white/10 p-6 text-sm text-slate-500">
Loading local tracker state… </div>
);
}

return ( <div className="space-y-8"> <WorkflowSummaryBanner
     matches={workflowMatches}
     workbookCurrentWeek={workflowBaseline}
     userLeague={workflowUserLeague}
     compact
   />

  {messages.length > 0 && (
    <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
      <ul className="list-disc space-y-1 pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )}

  {!state.activeWorkflow && splitReview.regularPhaseComplete && (
    <section className="border border-amber-400/30 bg-[#111722]">
      <div className="border-b border-amber-400/20 bg-amber-400/10 p-6">
        <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
          Opening Split completion
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase">
          Tiebreaker Review
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Final regular standings through Week {splitReview.completedRegularSplitWeek}. Next phase: {splitReview.nextPhase}.
        </p>
      </div>

      <div className="grid gap-px bg-white/10 xl:grid-cols-4">
        {[...new Set(splitReview.finalRegularStandings.map((row) => row.league))].map((league) => (
          <div key={league} className="bg-[#111722] p-4">
            <h3 className="mb-3 text-sm font-black uppercase">{league}</h3>
            <ol className="space-y-2">
              {splitReview.finalRegularStandings.filter((row) => row.league === league).map((row) => (
                <li key={row.wrestler} className="flex justify-between text-xs">
                  <span>#{row.rank} {row.wrestler}</span>
                  <strong>{row.points} pts</strong>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-white/10 p-6">
        <h3 className="font-black uppercase">Consequential tied groups</h3>
        {splitReview.consequentialTies.length === 0 ? (
          <p className="text-sm text-emerald-300">
            No point tie crosses a currently known competitive-zone boundary.
          </p>
        ) : splitReview.consequentialTies.map((tie) => (
          <div key={`${tie.league}-${tie.points}-${tie.wrestlers.join("-")}`} className="border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black uppercase">{tie.league}</p>
                <p className="mt-1 text-sm text-slate-300">
                  Places {tie.placements.join(", ")} · {tie.wrestlers.join(" / ")} · {tie.points} points
                </p>
              </div>
              <span className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-black uppercase text-amber-200">
                {tie.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{tie.explanation}</p>
            {tie.recommendedFormat && (
              <p className="mt-2 text-sm font-bold text-amber-200">
                Recommended format: {tie.recommendedFormat}
              </p>
            )}
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Multi-man ties are ranked by longest winning streak first. Aggregate head-to-head mini-tables are not used; head-to-head is allowed only for a remaining clean two-wrestler subgroup.
        </p>
        {splitReview.sourceWarnings.map((warning) => (
          <div key={warning} className="border-l-2 border-amber-400 bg-amber-400/5 p-4 text-sm text-amber-200">
            Source warning: {warning}
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Week 24 League Finals may follow tiebreaker review, but this phase does not generate its card or assume Global Elite Cup semifinal seeding.
        </p>
      </div>
    </section>
  )}

  {progress ? (
    <>
      <div className="border border-white/10 bg-[#111722] p-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-400">
          Current active app week
        </p>

        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-black uppercase">Week {week}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Status:{" "}
              {progress.status === "complete-unlocked"
                ? "Complete but unlocked — ready to lock"
                : "Incomplete — confirmed results still required"}
            </p>
          </div>

          <p className="text-sm text-slate-500">
            Workbook completed through Week {originalWorkbookCurrentWeek}
            {latestAppWritebackWeek !== null && (
              <> · App workbook baseline through Week {latestAppWritebackWeek} (App_* sheets)</>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <ProgressCard label="Scheduled" value={progress.total} color="text-white" />
        <ProgressCard label="Manual" value={progress.manual} color="text-sky-300" />
        <ProgressCard label="Simulation" value={progress.simulation} color="text-violet-300" />
        <ProgressCard
          label="State"
          value={progress.status === "complete-unlocked" ? "Ready" : "Open"}
          color="text-white"
        />
      </div>

      {progress.validationErrors.length > 0 && (
        <div className="border border-amber-400/30 bg-amber-400/5 p-5">
          <p className="font-black uppercase text-amber-300">
            Completion validation
          </p>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {progress.validationErrors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>

          {progress.validationErrors.length > 8 && (
            <p className="mt-2 text-xs text-slate-500">
              Plus {progress.validationErrors.length - 8} additional
              validation messages.
            </p>
          )}
        </div>
      )}

    </>
  ) : (
    <div className="border border-emerald-400/20 bg-emerald-400/5 p-10 text-center">
      <h2 className="text-3xl font-black uppercase">
        {state.activeWorkflow ? "Closing Split workflow complete" : splitReview.regularPhaseComplete ? "Opening Split regular season complete" : "Season workflow complete"}
      </h2>
      <p className="mt-2 text-slate-400">
        {state.activeWorkflow
          ? "Every authoritative Closing Split regular week is locked in browser-local tracker state."
          : splitReview.regularPhaseComplete
          ? "Next phase: Tiebreaker Review. No normal Week 23 fixtures are generated."
          : "Every later authoritative scheduled week is locked in browser-local tracker state."}
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <StateControls
          downloadExport={downloadExport}
          importInput={importInput}
          importFile={importFile}
          reset={reset}
        />
      </div>
    </div>
  )}

  {latestLockedWeek !== null && (
    <div className="flex flex-col justify-between gap-4 border border-emerald-400/30 bg-emerald-400/10 p-5 sm:flex-row sm:items-center">
      <div>
        <p className="font-black uppercase text-emerald-200">
          Week {latestLockedWeek} is complete and locked
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Its results are protected from edits. Progression and standings
          are local app-state only; Excel remains unchanged.
        </p>
      </div>

      <button
        type="button"
        onClick={() => unlock(latestLockedWeek)}
        className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-amber-200"
      >
        Unlock Week {latestLockedWeek} with warning
      </button>
    </div>
  )}
  {progress && (
    <div className="border border-white/10 bg-[#111722] p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-black uppercase">Close Week {week}</p>
            <p className="mt-1 text-sm text-slate-400">
              {progress.status === "complete-unlocked"
                ? "All validation passed. Locking protects these results and advances the workflow."
                : "Locking stays disabled until all 24 authoritative results pass validation."}
            </p>
          </div>

          <button
            disabled={progress.status !== "complete-unlocked"}
            onClick={markComplete}
            className="rounded-lg bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Complete & lock Week {week}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/results"
            className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
          >
            Result Entry
          </Link>

          <Link
            href="/simulation"
            className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
          >
            Simulation
          </Link>

          <StateControls
            downloadExport={downloadExport}
            importInput={importInput}
            importFile={importFile}
            reset={reset}
          />
        </div>
      </div>
  )}

  <PromoteCurrentMaster
    state={state}
    allMatches={workflowMatches}
    baselineStandings={baselineStandings}
    userLeague={workflowUserLeague}
    workbookCompletedThroughWeek={workbookCurrentWeek}
    source={sourceFile}
    promptPreview={<MiniLiveStandingsPreview standings={updatedStandings} split={activeSplit} splitWeek={activeSplitWeek} latestLockedWeek={latestLockedWeek} currentUserWrestler={userWrestler} championRoles={getPreviousSplitChampionColorRoles(completedSplitAudit)} />}
  />

  <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:justify-between">
    <span>
      Last export:{" "}
      {state.lastExportedAt
        ? new Date(state.lastExportedAt).toLocaleString()
        : "Never"}
    </span>
    <span>
      Last import:{" "}
      {state.lastImportedAt
        ? new Date(state.lastImportedAt).toLocaleString()
        : "Never"}
    </span>
  </div>

</div>

);
}


function MiniLiveStandingsPreview({
standings,
split,
splitWeek,
latestLockedWeek,
currentUserWrestler,
championRoles,
}: {
standings: StandingRow[];
split: SplitName;
splitWeek: number | null;
latestLockedWeek: number | null;
currentUserWrestler?: string | null;
championRoles: Map<string, PreviousSplitNameColorRole>;
}) {
return (
  <section className="mt-5 border border-white/10 bg-[#0b111c]/80 p-4" aria-label="Mini live standings preview">
    <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-300">Live Standings source</p>
        <h2 className="mt-1 text-xl font-black uppercase">Mini standings preview</h2>
        <p className="mt-1 text-xs text-slate-400">{split}{splitWeek ? ` · Split Week ${splitWeek}` : ""}{latestLockedWeek ? ` · updated through locked Year Week ${latestLockedWeek}` : ""}</p>
      </div>
      <Link href="/live-standings" className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">Full Live Standings</Link>
    </div>
    <div className="mini-standings-grid mt-5 grid gap-5 lg:grid-cols-2">
      {LEAGUE_NAMES.map((league) => {
        const rows = standings.filter((row) => row.league === league).sort((a, b) => a.rank - b.rank);
        return <article key={league} className="mini-standings-card border border-white/10 bg-[#111722]">
          <header className="mini-standings-card-header border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-black uppercase tracking-[.14em] text-white">{league}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">12 wrestlers</span>
          </header>
          <div className="mini-standings-table-wrap">
            <table className="mini-standings-table">
              <thead><tr><th>#</th><th>Wrestler</th><th>Pts</th><th>Status</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.wrestler} className={`placement-${placementZone(row.rank, league)}`}>
                <td className="mini-standings-rank">{row.rank}</td>
                <td className="mini-standings-wrestler"><strong title={row.wrestler}><WrestlerNameWithRole wrestler={row.wrestler} currentUserWrestler={currentUserWrestler} championRoles={championRoles} /></strong></td>
                <td className="mini-standings-points"><strong>{row.points}</strong></td>
                <td className="mini-standings-status"><span className="mini-standings-zone-pill zone-pill">{placementLabel(league, row.rank)}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>;
      })}
    </div>
  </section>
);
}

function ProgressCard({
label,
value,
color,
}: {
label: string;
value: string | number;
color: string;
}) {
return ( <div className="border border-white/10 bg-[#111722] p-5"> <p className="text-[10px] uppercase tracking-wider text-slate-500">
{label} </p>
<p className={"mt-2 text-2xl font-black " + color}>{value}</p> </div>
);
}

function StateControls({
downloadExport,
importInput,
importFile,
reset,
}: {
downloadExport: () => void;
importInput: RefObject<HTMLInputElement | null>;
importFile: (file: File | undefined) => void | Promise<void>;
reset: () => void;
}) {
return (
<> <button
     onClick={downloadExport}
     className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
   >
Export JSON </button>

  <button
    onClick={() => importInput.current?.click()}
    className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
  >
    Import JSON
  </button>

  <input
    ref={importInput}
    type="file"
    accept="application/json,.json"
    onChange={(event) => importFile(event.target.files?.[0])}
    className="hidden"
  />

  <button
    onClick={reset}
    className="rounded-lg ml-auto border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-red-300"
  >
    Reset local tracker state
  </button>
</>

);
}
