"use client";

import { useState } from "react";
import { createWeeklyCloseExports } from "@/domain/weekly-close-exports";
import type { TrackerState } from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";

interface PromoteCurrentMasterProps {
  state: TrackerState;
  allMatches: Match[];
  baselineStandings: StandingRow[];
  userLeague: LeagueName;
  workbookCompletedThroughWeek: number;
  source: string;
}

export function PromoteCurrentMaster(props: PromoteCurrentMasterProps) {
  const [promoting, setPromoting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    lines: string[];
  } | null>(null);
  const exports = createWeeklyCloseExports(
    props.state,
    props.allMatches,
    props.baselineStandings,
    props.userLeague,
    props.workbookCompletedThroughWeek,
    props.source,
  );

  async function promote() {
    if (!exports.ok) return;
    setPromoting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/promote-current-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: exports.packageJson,
      });
      const body = (await response.json()) as {
        filename?: string;
        backupFilename?: string;
        errors?: string[];
      };
      if (!response.ok) {
        setMessage({
          kind: "error",
          lines: body.errors ?? ["The current master workbook could not be promoted."],
        });
        return;
      }
      setMessage({
        kind: "success",
        lines: [
          `Promoted ${body.filename}.`,
          `Previous current master archived as ${body.backupFilename}. Restart the app to load the promoted workbook.`,
        ],
      });
    } catch {
      setMessage({
        kind: "error",
        lines: ["The current master workbook could not be promoted. Please try again."],
      });
    } finally {
      setPromoting(false);
    }
  }

  return (
    <section className="border border-violet-400/20 bg-[#111722] p-5">
      <p className="font-black uppercase text-violet-300">Promote Current Master</p>
      <p className="mt-2 text-sm text-slate-400">
        Promotes the locked updated workbook as the local current master file.
      </p>
      <p className="mt-2 text-sm font-bold text-amber-200">
        This only updates the local project files. Git commit/push remains manual.
      </p>
      {!exports.ok && (
        <p className="mt-3 text-sm text-amber-300">{exports.reason}</p>
      )}
      {message && (
        <ul
          className={`mt-3 list-disc space-y-1 pl-5 text-sm ${
            message.kind === "success" ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {message.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <button
        type="button"
        disabled={!exports.ok || promoting}
        onClick={promote}
        className="mt-4 border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-violet-200 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {promoting
          ? "Promoting updated workbook…"
          : "Promote updated workbook as current master"}
      </button>
    </section>
  );
}
