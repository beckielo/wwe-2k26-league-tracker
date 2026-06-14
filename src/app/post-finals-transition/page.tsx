import { PostFinalsTransitionView } from "@/components/post-finals-transition";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function PostFinalsTransitionPage() {
  const data = loadTrackerData();
  const hasAuthoritativeClosingSchedule = data.matches.some((match) => match.split === "Closing Split");
  return <>
    <PageHeader
      eyebrow="Phase 9B · Post-Finals"
      title="Post-Finals Transition"
      description="Validates completed League Finals, resolves movement, previews the new league composition, and guards Closing Split readiness without inventing Week 25."
    />
    <PostFinalsTransitionView
      completedThroughWeek={data.meta.appBaselineCompletedThroughWeek}
      leagueYear={data.meta.leagueYear}
      split={data.meta.currentSplit}
      standings={data.standings}
      matches={data.matches}
      results={data.results}
      matchupReference={data.matchupReference}
      hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate}
      hasAuthoritativeClosingSchedule={hasAuthoritativeClosingSchedule}
    />
  </>;
}
