import { SimulationWorkflow } from "@/components/simulation-workflow";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function SimulationPage() {
const data = loadTrackerData();

const description =
"Generate explainable previews only for open non-user league matches in the active app week. " +
data.meta.userLeague +
" remains excluded.";

return (
<> <PageHeader
     eyebrow="Phase 3B · active non-user shows"
     title="Simulation Studio"
     description={description}
   />

  <SimulationWorkflow
    matches={data.matches}
    matchupReference={data.matchupReference}
    leagues={data.leagues}
    standings={data.standings}
    streaks={data.streaks}
    existingResults={data.results}
    workbookCurrentWeek={data.meta.currentWeek}
    userLeague={data.meta.userLeague}
    userWrestler={data.meta.userWrestler}
  />
</>

);
}
