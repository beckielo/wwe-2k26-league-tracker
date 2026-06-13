import { ResultEntryWorkflow } from "@/components/result-entry-workflow";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
const data = loadTrackerData();

return (
<> <PageHeader
     eyebrow="Phase 3B · active user show"
     title="Result Entry"
     description="Enter only the user-controlled league results for the active app week. The active week advances from workbook baseline through browser-local week locks."
   />

  <ResultEntryWorkflow
    matches={data.matches}
    workbookCurrentWeek={data.meta.currentWeek}
    userLeague={data.meta.userLeague}
    userWrestler={data.meta.userWrestler}
  />
</>

);
}
