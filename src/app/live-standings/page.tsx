import { LiveStandings } from "@/components/live-standings";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function LiveStandingsPage() {
  const data = loadTrackerData();
  return <LiveStandings baseline={data.standings} workbookMatches={data.matches} meta={data.meta} sourceFile={data.sourceFile} />;
}
