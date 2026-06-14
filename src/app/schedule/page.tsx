import { PageHeader } from "@/components/ui";
import { ActiveSchedule } from "@/components/active-schedule";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const data = loadTrackerData();
  return <>
    <PageHeader eyebrow="Primary workflow · authoritative card" title="Schedule" description="See the active split-relative card exactly as supplied by the workbook or accepted schedule snapshot. The application never guesses fixtures." />
    <ActiveSchedule workbookMatches={data.matches} workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek} />
  </>;
}
