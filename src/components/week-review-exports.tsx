"use client";

import { createWeeklyCloseExports } from "@/domain/weekly-close-exports";
import type { TrackerState } from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";

interface WeekReviewExportsProps {
  state: TrackerState;
  allMatches: Match[];
  baselineStandings: StandingRow[];
  userLeague: LeagueName;
  workbookCompletedThroughWeek: number;
  source: string;
}

function downloadFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WeekReviewExports({
  state,
  allMatches,
  baselineStandings,
  userLeague,
  workbookCompletedThroughWeek,
  source,
}: WeekReviewExportsProps) {
  const exports = createWeeklyCloseExports(
    state,
    allMatches,
    baselineStandings,
    userLeague,
    workbookCompletedThroughWeek,
    source,
  );

  if (!exports.ok) {
    return (
      <section className="border border-white/10 bg-[#111722] p-5">
        <p className="font-black uppercase text-slate-300">Weekly close exports</p>
        <p className="mt-1 text-sm text-slate-500">{exports.reason}</p>
        <button
          type="button"
          disabled
          className="mt-4 cursor-not-allowed border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600"
        >
          Exports unavailable
        </button>
      </section>
    );
  }

  const prefix = `wwe-2k26-week-${exports.week}`;

  return (
    <section className="border border-emerald-400/20 bg-[#111722] p-5">
      <p className="font-black uppercase text-emerald-300">
        Week {exports.week} close package
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Download safe snapshots from locked app state. The source workbook is never modified.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ExportButton
          label="Close package JSON"
          onClick={() =>
            downloadFile(exports.packageJson, `${prefix}-close-package.json`, "application/json")
          }
        />
        <ExportButton
          label="Weekly results CSV"
          onClick={() =>
            downloadFile(exports.resultsCsv, `${prefix}-results.csv`, "text/csv;charset=utf-8")
          }
        />
        <ExportButton
          label="App-state standings CSV"
          onClick={() =>
            downloadFile(
              exports.standingsCsv,
              `${prefix}-app-state-standings.csv`,
              "text/csv;charset=utf-8",
            )
          }
        />
      </div>
    </section>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-200"
    >
      {label}
    </button>
  );
}
