"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createWeeklyCloseExports } from "@/domain/weekly-close-exports";
import type { TrackerState } from "@/domain/tracker-state";
import type { LeagueName, Match, StandingRow } from "@/domain/types";
import type { StepLog } from "@/domain/current-master-finalization";

interface PromoteCurrentMasterProps {
  state: TrackerState;
  allMatches: Match[];
  baselineStandings: StandingRow[];
  userLeague: LeagueName;
  workbookCompletedThroughWeek: number;
  source: string;
  promptPreview?: ReactNode;
}

export function PromoteCurrentMaster(props: PromoteCurrentMasterProps) {
  const router = useRouter();
  const [promoting, setPromoting] = useState(false);
  const [promotedWeek, setPromotedWeek] = useState<number | null>(null);
  const [gitAutomationEnabled, setGitAutomationEnabled] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizationLogs, setFinalizationLogs] = useState<StepLog[]>([]);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    lines: string[];
  } | null>(null);
  const scheduleSourceLabel = props.state.acceptedSchedule
    ? props.state.acceptedSchedule.source === "Generated"
      ? "Schedule Source: accepted generated snapshot"
      : "Schedule Source: accepted imported snapshot"
    : "Schedule Source: original workbook";

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
        week?: number;
        gitAutomationEnabled?: boolean;
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
          `Previous current master archived as ${body.backupFilename}.`,
        ],
      });
      setPromotedWeek(body.week ?? exports.week);
      setGitAutomationEnabled(body.gitAutomationEnabled === true);
    } catch {
      setMessage({
        kind: "error",
        lines: ["The current master workbook could not be promoted. Please try again."],
      });
    } finally {
      setPromoting(false);
    }
  }

  function stayHere() {
    setPromotedWeek(null);
    setFinalizationLogs([]);
  }

  async function finalize() {
    if (promotedWeek === null || !gitAutomationEnabled) return;
    setFinalizing(true);
    setFinalizationLogs([]);
    try {
      const response = await fetch("/api/finalize-current-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: promotedWeek }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        logs?: StepLog[];
      };
      setFinalizationLogs(body.logs ?? []);
      if (!response.ok || !body.ok) {
        setMessage({
          kind: "error",
          lines: [body.message ?? "Git finalization failed."],
        });
        return;
      }
      setMessage({
        kind: "success",
        lines: [body.message ?? "The promoted workbook was saved to GitHub."],
      });
      router.push("/");
      router.refresh();
    } catch {
      setMessage({
        kind: "error",
        lines: ["Git finalization could not be completed. Please try again."],
      });
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <section className="border border-violet-400/20 bg-[#111722] p-5">
      <p className="font-black uppercase text-violet-300">Promote Current Master</p>
      <p className="mt-2 text-sm text-slate-400">
        Promotes the locked updated workbook as the local current master file.
      </p>
      <p className="mt-2 text-sm font-bold text-violet-100">{scheduleSourceLabel}</p>
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
        className="rounded-lg mt-4 border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-violet-200 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {promoting
          ? "Promoting updated workbook…"
          : "Promote updated workbook as current master"}
      </button>
      {promotedWeek !== null && (
        <div className="mt-5 border border-emerald-400/30 bg-emerald-400/5 p-4">
          <p className="text-sm font-bold text-emerald-200">
            The updated workbook was promoted as the current master. Do you want
            to save this state to GitHub and continue to the next week?
          </p>
          {!gitAutomationEnabled && (
            <p className="mt-3 text-sm font-bold text-amber-200">
              Git finalization is disabled. Set ALLOW_LOCAL_GIT_AUTOMATION=true
              before starting npm run dev.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={finalizing || !gitAutomationEnabled}
              onClick={finalize}
              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {finalizing ? "Saving and validating…" : "Yes, save and continue"}
            </button>
            <button
              type="button"
              disabled={finalizing}
              onClick={stayHere}
              className="rounded-lg border border-slate-500/40 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 disabled:opacity-35"
            >
              No, stay here
            </button>
          </div>
        </div>
      )}
      {props.promptPreview}
      {finalizationLogs.length > 0 && (
        <ol className="mt-4 space-y-2 text-sm">
          {finalizationLogs.map((log) => (
            <li key={log.step} className={log.status === "failed" ? "text-red-300" : "text-emerald-300"}>
              <span className="font-black">{log.step}:</span>{" "}
              <span className="whitespace-pre-wrap">{log.output}</span>
            </li>
          ))}
          {finalizationLogs.every((log) => log.status !== "failed") && (
            <li className="font-black text-emerald-300">Reload: loading the next active week…</li>
          )}
        </ol>
      )}
    </section>
  );
}
