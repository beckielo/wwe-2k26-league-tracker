import { ResultEntryWorkflow } from "@/components/result-entry-workflow";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
const data = loadTrackerData();

return (
<> <PageHeader
     eyebrow="Primary workflow · current show"
     title="Result Entry"
     description="Select winners for the current user-controlled show. Saved state, progression, and any lock reason remain visible without requiring a finish type."
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
