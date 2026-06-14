import Link from "next/link";
import { AdvancedDetails, PageHeader, Panel, Stat, StatusBadge, WarningPanel } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { DashboardActiveStatus, DashboardPhaseNotice } from "@/components/dashboard-active-status";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
const data = loadTrackerData();
const nextWeek = data.meta.appBaselineCompletedThroughWeek + 1;
const nextMatches = data.matchupReference
.filter(
(match) =>
match.league === data.meta.userLeague && match.week === nextWeek,
)
.sort((a, b) => a.matchNumber - b.matchNumber);

const errors = data.validationIssues.filter(
(issue) => issue.severity === "error",
);
const warnings = data.validationIssues.filter(
(issue) => issue.severity === "warning",
);

return (
<>
<PageHeader
eyebrow="Workbook baseline + local workflow"
title="League Command Center"
description="One clear view of the current run, the safest next action, completed phases, active locks, and authoritative source state."
aside={ <div className="flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"> <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
Source connected </div>
}
/>

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <Stat
      label="League year"
      value={data.meta.leagueYear}
      detail="48-week calendar"
    />
    <DashboardActiveStatus />
      <Stat
      label="Workbook baseline"
      value={"Year Week " + data.meta.currentWeek}
      detail={data.meta.currentStatus}
    />
    {data.meta.latestAppWritebackWeek !== null && (
      <Stat
        label="Latest writeback"
        value={"Year Week " + data.meta.latestAppWritebackWeek}
        detail="Using validated App_* writeback sheets"
      />
    )}
    <Stat
      label="Data health"
      value={errors.length ? errors.length + " errors" : "Verified"}
      detail={warnings.length + " source warnings"}
    />
  </div>

  <DashboardPhaseNotice />

  <div className="mt-8 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
    <Panel>
      <div className="flex items-start justify-between border-b border-white/10 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">
            Authoritative next card
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase">
            {data.meta.userLeague}
          </h2>
        </div>

        <Link
          href="/schedule"
          className="border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
        >
          Full schedule →
        </Link>
      </div>

      <div className="divide-y divide-white/10">

        {nextMatches.map((match) => (
          <div
            key={match.matchNumber}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-6 py-4 transition hover:bg-white/[.025]"
          >
            <span className="text-xs font-black text-slate-600">
              {String(match.matchNumber).padStart(2, "0")}
            </span>

            <div className="flex items-center justify-center gap-3 text-center font-bold sm:text-lg">
              <span className="flex-1 text-right">{match.wrestlerA}</span>
              <span className="text-xs italic text-red-400">VS</span>
              <span className="flex-1 text-left">{match.wrestlerB}</span>
            </div>

            <StatusBadge tone="ready">Verified</StatusBadge>
          </div>
        ))}
      </div>
    </Panel>

    <Panel>
      <div className="border-b border-white/10 p-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">
          Validation monitor
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase">
          Active alerts
        </h2>
      </div>

      <div className="space-y-3 p-5">
        {errors.length === 0 && warnings.length === 0 && (
          <div className="border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            All roster, schedule, points, and record checks pass.
          </div>
        )}

        {errors.map((issue) => <WarningPanel key={issue.code} category="Blocking" title={issue.code.replaceAll("_", " ")}>{issue.message}</WarningPanel>)}
        {warnings.length > 0 && <AdvancedDetails summary={`${warnings.length} source warnings · non-blocking`}>
          <div className="space-y-3">{warnings.map((issue) => <WarningPanel key={issue.code + (issue.source?.sheet ?? "")} category="Source Warning" title={issue.code.replaceAll("_", " ")} collapsible>{issue.message}</WarningPanel>)}</div>
        </AdvancedDetails>}
      </div>
    </Panel>
  </div>

  <div className="mt-8 flex flex-col justify-between gap-3 border border-white/10 bg-white/[.025] px-5 py-4 text-xs text-slate-500 sm:flex-row">
    <span>Source: {data.sourceFile}</span>
    <span>
      {data.matches.length} scheduled matches · {data.results.length} completed results · {data.leagues.length} leagues
    </span>
  </div>
</>

);
}
