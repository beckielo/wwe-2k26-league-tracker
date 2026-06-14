import { LeagueFinals } from "@/components/league-finals";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function LeagueFinalsPage() {
  const data = loadTrackerData();
  return <>
    <PageHeader
      eyebrow="Phase 9 · Week 24"
      title="League Finals"
      description="Source-derived Night One and Night Two cards, separate event results, guarded completion, and a handoff to the Post-Finals Transition."
    />
    <LeagueFinals
      completedThroughWeek={data.meta.appBaselineCompletedThroughWeek}
      leagueYear={data.meta.leagueYear}
      split={data.meta.currentSplit}
      standings={data.standings}
      matches={data.matches}
      results={data.results}
      matchupReference={data.matchupReference}
      hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate}
    />
  </>;
}
