import { PageHeader } from "@/components/ui";
import { WeekReview } from "@/components/week-review";
import { loadLegacyTableData, loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function WeekReviewPage() {
const data = loadTrackerData();
const legacy = loadLegacyTableData();

return (
<> <PageHeader
     eyebrow="Primary workflow · final checkpoint"
     title="Week Review"
     description="Review every league, resolve missing or invalid results, safely lock a completed week, manage local state, and inspect standings without changing Excel."
   />

  <WeekReview
    allMatches={data.matches}
    baselineStandings={data.standings}
    workbookResults={data.results}
    matchupReference={data.matchupReference}
    leagueYear={data.meta.leagueYear}
    split={data.meta.currentSplit}
    hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate}
    userLeague={data.meta.userLeague}
    workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek}
    originalWorkbookCurrentWeek={data.meta.currentWeek}
    latestAppWritebackWeek={data.meta.latestAppWritebackWeek}
    sourceFile={data.sourceFile}
    userWrestler={data.meta.userWrestler}
    completedSplitAudit={legacy.summary.audit}
  />
</>

);
}
