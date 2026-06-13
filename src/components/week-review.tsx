"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type RefObject } from "react";
import { WorkflowSummaryBanner } from "./workflow-summary-banner";
import { WeekReviewExports } from "./week-review-exports";
import {
calculateStandingsWithConfirmedResults,
completeWeek,
removeResult,
unlockWeek,
} from "@/domain/tracker-state";
import { getWorkflowSummary } from "@/domain/week-progression";
import type { LeagueName, Match, StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

interface WeekReviewProps {
allMatches: Match[];
baselineStandings: StandingRow[];
userLeague: LeagueName;
workbookCurrentWeek: number;
}

export function WeekReview({
allMatches,
baselineStandings,
userLeague,
workbookCurrentWeek,
}: WeekReviewProps) {
const { state, replaceState, exportState, importState, resetState, hydrated } =
useTrackerState();

const [messages, setMessages] = useState<string[]>([]);
const importInput = useRef<HTMLInputElement>(null);

const summary = getWorkflowSummary(
state,
allMatches,
workbookCurrentWeek,
userLeague,
);

const week = summary.activeWeek;
const progress = summary.progress;

const weekMatches =
week === null
? []
: allMatches.filter(
(match) => match.week === week && match.status === "scheduled",
);

const resultByMatch = new Map(
progress?.confirmedResults.map((result) => [result.matchId, result]) ?? [],
);

const leagues = [...new Set(weekMatches.map((match) => match.league))];
const latestLockedWeek = summary.latestLockedWeek;

const updatedStandings = useMemo(
() =>
calculateStandingsWithConfirmedResults(
baselineStandings,
allMatches,
state.confirmedResults.filter(
(result) => latestLockedWeek !== null && result.week <= latestLockedWeek,
),
),
[allMatches, baselineStandings, latestLockedWeek, state.confirmedResults],
);

function markComplete() {
if (week === null) return;

const action = completeWeek(state, week, allMatches, userLeague);

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

function remove(matchId: string) {
const action = removeResult(state, matchId);

if (!action.ok) {
  setMessages(action.errors);
  return;
}

replaceState(action.state);
setMessages([]);

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

const errors = importState(await file.text(), allMatches, userLeague);

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
     matches={allMatches}
     workbookCurrentWeek={workbookCurrentWeek}
     userLeague={userLeague}
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
        className="border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-amber-200"
      >
        Unlock Week {latestLockedWeek} with warning
      </button>
    </div>
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
            Workbook completed through Week {workbookCurrentWeek}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <ProgressCard label="Scheduled" value={progress.total} color="text-white" />
        <ProgressCard label="Confirmed" value={progress.confirmed} color="text-emerald-300" />
        <ProgressCard label="Missing" value={progress.missing} color="text-amber-300" />
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="border border-amber-400/20 bg-[#111722]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">
              Missing results
            </p>
            <h2 className="mt-1 text-xl font-black uppercase">
              Grouped by league
            </h2>
          </div>

          <div className="divide-y divide-white/10">
            {leagues.map((league) => {
              const missing = progress.missingMatches.filter(
                (match) => match.league === league,
              );

              return (
                <div key={league} className="p-5">
                  <div className="flex justify-between">
                    <h3 className="font-black uppercase">{league}</h3>
                    <span className="text-xs text-amber-300">
                      {missing.length} missing
                    </span>
                  </div>

                  {missing.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      {missing.map((match) => (
                        <li key={match.id}>
                          Match {match.matchNumber}: {match.wrestlerA} vs{" "}
                          {match.wrestlerB}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-300">
                      All six results confirmed.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-emerald-400/20 bg-[#111722]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">
              Confirmed results
            </p>
            <h2 className="mt-1 text-xl font-black uppercase">
              Grouped by league
            </h2>
          </div>

          <div className="divide-y divide-white/10">
            {leagues.map((league) => {
              const confirmedMatches = weekMatches.filter(
                (match) =>
                  match.league === league && resultByMatch.has(match.id),
              );

              return (
                <div key={league} className="p-5">
                  <div className="flex justify-between">
                    <h3 className="font-black uppercase">{league}</h3>
                    <span className="text-xs text-emerald-300">
                      {confirmedMatches.length}/6
                    </span>
                  </div>

                  {confirmedMatches.length ? (
                    <div className="mt-3 space-y-3">
                      {confirmedMatches.map((match) => {
                        const result = resultByMatch.get(match.id);

                        if (!result) return null;

                        return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-slate-300">
                              {match.wrestlerA} vs {match.wrestlerB}
                              <small className="ml-2 text-slate-600">
                                {result.source}
                              </small>
                            </span>

                            <div className="flex items-center gap-2">
                              <strong className="text-emerald-300">
                                {result.resultType === "Winner"
                                  ? result.winner + " wins"
                                  : result.resultType}
                              </strong>

                              <button
                                type="button"
                                onClick={() => remove(match.id)}
                                className="border border-white/10 px-2 py-1 text-[10px] uppercase text-slate-500"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No confirmed results.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

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
            className="bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Complete & lock Week {week}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/results"
            className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
          >
            Result Entry
          </Link>

          <Link
            href="/simulation"
            className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
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
    </>
  ) : (
    <div className="border border-emerald-400/20 bg-emerald-400/5 p-10 text-center">
      <h2 className="text-3xl font-black uppercase">
        Season workflow complete
      </h2>
      <p className="mt-2 text-slate-400">
        Every later authoritative scheduled week is locked in browser-local
        tracker state.
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

  {latestLockedWeek !== null && (
    <section className="border border-white/10 bg-[#111722]">
      <div className="border-b border-white/10 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">
          App-state calculation
        </p>
        <h2 className="mt-1 text-xl font-black uppercase">
          Updated standings through locked Week {latestLockedWeek}
        </h2>
      </div>

      <div className="grid gap-px bg-white/10 xl:grid-cols-4">
        {[...new Set(updatedStandings.map((row) => row.league))].map(
          (league) => (
            <div key={league} className="bg-[#111722] p-4">
              <h3 className="mb-3 text-sm font-black uppercase">{league}</h3>
              <ol className="space-y-2">
                {updatedStandings
                  .filter((row) => row.league === league)
                  .map((row) => (
                    <li
                      key={row.wrestler}
                      className="flex justify-between text-xs"
                    >
                      <span>
                        #{row.rank} {row.wrestler}
                      </span>
                      <strong>{row.points} pts</strong>
                    </li>
                  ))}
              </ol>
            </div>
          ),
        )}
      </div>
    </section>
  )}

  <WeekReviewExports
    state={state}
    allMatches={allMatches}
    baselineStandings={baselineStandings}
    userLeague={userLeague}
    workbookCurrentWeek={workbookCurrentWeek}
  />
</div>

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
     className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
   >
Export JSON </button>

  <button
    onClick={() => importInput.current?.click()}
    className="border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300"
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
    className="ml-auto border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-red-300"
  >
    Reset local tracker state
  </button>
</>

);
}
