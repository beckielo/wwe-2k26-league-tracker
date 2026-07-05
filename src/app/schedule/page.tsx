import { PageHeader } from "@/components/ui";
import { ActiveSchedule } from "@/components/active-schedule";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const data = loadTrackerData();
  return <>
    <PageHeader eyebrow="Primary workflow · current card" title="Schedule" description="See the current split card exactly as scheduled. The application never guesses fixtures." />
    <ActiveSchedule workbookMatches={data.matches} workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek} />
  </>;
}
