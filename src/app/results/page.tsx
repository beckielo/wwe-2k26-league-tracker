import { ResultEntryWorkflow } from "@/components/result-entry-workflow";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
const data = loadTrackerData();

return (
<> <PageHeader
     eyebrow="Phase 3C · active user show"
     title="Result Entry"
     description="Enter and review only the user-controlled league results for the active app week. The workbook card is authoritative; browser-local state tracks progress."
   />

  <ResultEntryWorkflow
    matches={data.matches}
    workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek}
    userLeague={data.meta.userLeague}
    userWrestler={data.meta.userWrestler}
  />
</>

);
}
