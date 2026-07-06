import { CurrentSplitCalendar } from "@/components/current-split-calendar";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const data = loadTrackerData();
  return <>
    <PageHeader
      eyebrow="Current split / confirmed results"
      title="Calendar"
      description="Move between completed matchdays, review confirmed results by league, or follow one wrestler across the active split. Previous splits and unconfirmed previews are excluded."
    />
    <CurrentSplitCalendar
      matches={data.matches}
      workbookResults={data.results}
      workbookCompletedThroughWeek={data.meta.appBaselineCompletedThroughWeek}
      standings={data.standings}
      userLeague={data.meta.userLeague}
    />
  </>;
}
