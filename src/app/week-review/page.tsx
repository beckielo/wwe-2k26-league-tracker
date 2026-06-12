import { PageHeader } from "@/components/ui";
import { WeekReview } from "@/components/week-review";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function WeekReviewPage() {
  const data = loadTrackerData();
  const week = Math.min(...data.matches.filter((match) => match.status === "scheduled").map((match) => match.week));
  const matches = data.matches.filter((match) => match.week === week);
  return <>
    <PageHeader eyebrow="Phase 3A · local tracker state" title={`Week ${week} Review`} description="Review all 24 authoritative matchups, fill missing manual and simulation results, validate completion, lock the week, and calculate app-state standings without changing the Excel workbook." />
    <WeekReview week={week} matches={matches} allMatches={data.matches} baselineStandings={data.standings} userLeague={data.meta.userLeague} />
  </>;
}
