import { LiveStandings } from "@/components/live-standings";
import { loadLegacyTableData, loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function LiveStandingsPage() {
  const data = loadTrackerData();
  const legacy = loadLegacyTableData();
  return <LiveStandings baseline={data.standings} workbookMatches={data.matches} workbookResults={data.results} meta={data.meta} sourceFile={data.sourceFile} completedSplitAudit={legacy.summary.audit} />;
}
