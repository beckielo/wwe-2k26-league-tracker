import { PageHeader } from "@/components/ui";
import { HistoryDashboard } from "@/components/history-dashboard";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const data = loadTrackerData();
  return <>
    <PageHeader eyebrow="Fact-only archive" title="History / Legacy Facts" description="Confirmed achievements and movement records only. Missing facts are never inferred." />
    <HistoryDashboard leagueYear={data.meta.leagueYear} split={data.meta.currentSplit} facts={[]} completedSplits={data.completedSplitHistory} />
  </>;
}
