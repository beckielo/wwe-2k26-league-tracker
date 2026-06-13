import { PageHeader } from "@/components/ui";
import { WeekReview } from "@/components/week-review";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function WeekReviewPage() {
const data = loadTrackerData();

return (
<> <PageHeader
     eyebrow="Phase 3B · week progression"
     title="Week Review"
     description="Review the active authoritative 24-match card, resolve missing results, lock a valid completed week, and advance the local workflow without changing Excel."
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