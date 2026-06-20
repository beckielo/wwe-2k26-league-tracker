import { DashboardControlCenter } from "@/components/dashboard-control-center";
import { PageHeader } from "@/components/ui";
import { loadLegacyTableData, loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <LeagueCommandCenterDashboard />;
}

function LeagueCommandCenterDashboard() {
  const data = loadTrackerData();
  const legacy = loadLegacyTableData();

  return (
    <>
      <PageHeader
        eyebrow="Workbook baseline + local workflow"
        title="League Command Center"
        description="Run the current show, resolve only what matters now, and move safely through the league year from one authoritative card."
        aside={
          <div className="source-status">
            <span />
            Workbook connected
          </div>
        }
      />

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
          leagueWinners: legacy.summary.leagueTitleRecords,
          eliteCupWinners: legacy.summary.eliteCupRecords,
          completedSplitAudit: legacy.summary.audit,
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
