import { PageHeader, Stat } from "@/components/ui";
import { loadLegacyTableData, loadTrackerData } from "@/data/workbook";
import { DashboardControlCenter } from "@/components/dashboard-control-center";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
const data = loadTrackerData();
const legacy = loadLegacyTableData();
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
description="Run the current show, resolve only what matters now, and move safely through the league year from one authoritative card."
aside={ <div className="source-status"><span />
Workbook connected </div>
}
/>

  <div className="dashboard-stats">
    <Stat
      label="League year"
      value={data.meta.leagueYear}
      detail={data.meta.currentSplit}
    />
    <Stat
      label="Completed baseline"
      value={`Through ${data.meta.currentSplit} Week ${data.meta.currentSplit === "Closing Split" ? data.meta.appBaselineCompletedThroughWeek - 24 : data.meta.appBaselineCompletedThroughWeek}`}
      detail="Authoritative workbook state"
    />
    <Stat
      label="User brand"
      value={data.meta.userLeague.replace(" League", "")}
      detail={data.meta.nextUserShow}
    />
    <Stat
      label="Control status"
      value={errors.length ? `${errors.length} Blocking ${errors.length === 1 ? "Issue" : "Issues"}` : warnings.length ? `${warnings.length} Source Warnings` : "Verified"}
      detail={errors.length ? "Workflow blockers require attention" : warnings.length ? "Non-blocking · details contained" : "No blocking or source issues"}
    />
  </div>

  <DashboardControlCenter
    workbookMatches={data.matches}
    workbookCompletedThroughWeek={data.meta.appBaselineCompletedThroughWeek}
    baselineStandings={data.standings}
    workbookResults={data.results}
    meta={data.meta}
    leagueYear={data.meta.leagueYear}
    userLeague={data.meta.userLeague}
    validationIssues={data.validationIssues}
    legacySummary={{
      leader: legacy.profiles[0]?.wrestler ?? null,
      leagueWinners: legacy.profiles.filter((profile) => profile.leagueWinsTotal > 0).length,
      eliteCupWinners: legacy.profiles.filter((profile) => profile.eliteCupWins > 0).length,
    }}
  />

  <div className="mt-8 flex flex-col justify-between gap-3 border border-white/10 bg-white/[.025] px-5 py-4 text-xs text-slate-500 sm:flex-row">
    <span>Source: {data.sourceFile}</span>
    <span>
      {data.matches.length} scheduled matches · {data.results.length} completed results · {data.leagues.length} leagues
    </span>
  </div>
</>

);
}
