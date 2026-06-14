import { PageHeader } from "@/components/ui";
import { ActiveSchedule } from "@/components/active-schedule";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const data = loadTrackerData();
  return <>
    <PageHeader eyebrow="Authoritative matchup reference" title="Active Week Card" description="Matchups come from the workbook until an explicitly accepted schedule snapshot is activated. The application never guesses fixtures." />
    <ActiveSchedule workbookMatches={data.matches} workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek} />
  </>;
}
