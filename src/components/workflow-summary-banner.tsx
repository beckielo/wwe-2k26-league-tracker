"use client";

import Link from "next/link";
import { getWorkflowSummary } from "@/domain/week-progression";
import type { LeagueName, Match } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { getWeekDisplay } from "@/domain/week-display";

interface WorkflowSummaryBannerProps {
  matches: Match[];
  workbookCurrentWeek: number;
  userLeague: LeagueName;
  compact?: boolean;
}

export function WorkflowSummaryBanner({
  matches,
  workbookCurrentWeek,
  userLeague,
  compact = false,
}: WorkflowSummaryBannerProps) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) {
    return <div className="border border-white/10 bg-[#111722] p-6 text-sm text-slate-500">Loading active workflow…</div>;
  }

  const workflowMatches = getActiveWorkflowMatches(state, matches);
  const workflowBaseline = state.activeWorkflow ? (state.activeWorkflow.split === "Closing Split" ? 24 : 0) : workbookCurrentWeek;
  const workflowUserLeague = state.activeWorkflow?.userLeague ?? userLeague;
  const summary = getWorkflowSummary(state, workflowMatches, workflowBaseline, workflowUserLeague);
  const progress = summary.progress;
  const display = summary.activeWeek === null ? null : getWeekDisplay(state.activeWorkflow?.leagueYear ?? 2, summary.activeWeek, state.activeWorkflow?.split);

  return (
    <section className="overflow-hidden border border-red-400/25 bg-gradient-to-r from-red-500/15 via-[#111722] to-[#111722]">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-red-400">
            Active browser-local workflow
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-2xl font-black uppercase sm:text-3xl">
              {display?.primary ?? "Season workflow complete"}
            </h2>
            <span className="text-sm text-slate-400">
              {display?.secondary ?? `Excel baseline: completed through Year Week ${summary.workbookCompletedThroughWeek}`}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            <strong className="text-white">{summary.recommendedLabel}.</strong>{" "}
            {summary.recommendedReason}
          </p>
          {!compact && (
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
              <Badge label="User league" value={summary.userLeague} />
              <Badge label="Latest local lock" value={summary.latestLockedWeek === null ? "None" : getWeekDisplay(state.activeWorkflow?.leagueYear ?? 2, summary.latestLockedWeek, state.activeWorkflow?.split).primary} />
              <Badge label="Confirmed" value={progress?.confirmed ?? "—"} />
              <Badge label="Manual" value={progress?.manual ?? "—"} />
              <Badge label="Simulation" value={progress?.simulation ?? "—"} />
              <Badge label="Missing" value={progress?.missing ?? "—"} tone={progress?.missing ? "warning" : "default"} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 xl:justify-end">
          {summary.recommendedAction !== "complete" && (
            <Link href={summary.recommendedHref} className="rounded-lg bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-[.14em] text-white">
              {summary.recommendedLabel} →
            </Link>
          )}
          {summary.activeWeek !== null && (
            <>
              {summary.recommendedHref !== "/results" && (
                <Link href="/results" className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">
                  Enter {workflowUserLeague} Results
                </Link>
              )}
              <Link href="/simulation" className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">Simulation</Link>
            </>
          )}
          <Link href="/week-review" className="rounded-lg border border-emerald-400/30 px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-300">Week Review</Link>
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/20 px-6 py-3 text-xs text-slate-500">
        Excel remains read-only. Confirmed results and week locks are an overlay stored only in this browser.
      </div>
    </section>
  );
}

function Badge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <span className={`rounded-lg border px-3 py-2 ${tone === "warning" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[.03] text-slate-300"}`}>
      <span className="text-slate-600">{label}:</span> {value}
    </span>
  );
}
