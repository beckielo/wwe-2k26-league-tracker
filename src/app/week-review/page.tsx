import { PageHeader } from "@/components/ui";
import { WeekReview } from "@/components/week-review";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function WeekReviewPage() {
const data = loadTrackerData();

return (
<> <PageHeader
     eyebrow="Phase 3C · week control center"
     title="Week Review"
     description="Review every league, resolve missing or invalid results, safely lock a completed week, manage local state, and inspect standings without changing Excel."
   />

  <WeekReview
    allMatches={data.matches}
    baselineStandings={data.standings}
    userLeague={data.meta.userLeague}
    workbookCurrentWeek={data.meta.currentWeek}
  />
</>

);
}