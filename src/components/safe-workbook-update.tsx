"use client";

import { useState } from "react";
import { createWeeklyCloseExports } from "@/domain/weekly-close-exports";
import type { TrackerState } from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";

interface SafeWorkbookUpdateProps {
  state: TrackerState;
  allMatches: Match[];
  baselineStandings: StandingRow[];
  userLeague: LeagueName;
  workbookCompletedThroughWeek: number;
  source: string;
}

export function SafeWorkbookUpdate(props: SafeWorkbookUpdateProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const exports = createWeeklyCloseExports(
    props.state,
    props.allMatches,
    props.baselineStandings,
    props.userLeague,
    props.workbookCompletedThroughWeek,
    props.source,
  );

  async function downloadWorkbook() {
    if (!exports.ok) return;
    setDownloading(true);
    setErrors([]);
    try {
      const response = await fetch("/api/workbook-writeback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: exports.packageJson,
      });
      if (!response.ok) {
        const body = (await response.json()) as { errors?: string[] };
        setErrors(body.errors ?? ["The updated workbook could not be generated."]);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        `WWE_2K26_Liga_System_LY2_Opening_W${exports.week}_abgeschlossen.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrors(["The updated workbook could not be generated. Please try again."]);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="border border-sky-400/20 bg-[#111722] p-5">
      <p className="font-black uppercase text-sky-300">Safe Workbook Update</p>
      <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
        <p>Latest locked week: {exports.ok ? exports.week : "None"}</p>
        <p>Source workbook completed through Week {props.workbookCompletedThroughWeek}</p>
        <p>Close package exportable: {exports.ok ? "Yes" : "No"}</p>
      </div>
      <p className="mt-3 text-sm font-bold text-emerald-200">
        Original Excel workbook will not be modified.
      </p>
      {!exports.ok && <p className="mt-2 text-sm text-amber-300">{exports.reason}</p>}
      {errors.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-300">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <button
        type="button"
        disabled={!exports.ok || downloading}
        onClick={downloadWorkbook}
        className="mt-4 border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {downloading ? "Generating workbook…" : "Download updated workbook"}
      </button>
    </section>
  );
}
