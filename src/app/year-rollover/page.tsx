import { YearRolloverContinuityView } from "@/components/year-rollover-continuity";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function YearRolloverPage() {
  const data = loadTrackerData();
  const nextSplit = data.meta.currentSplit === "Opening Split" ? "Closing Split" : "Opening Split";
  const nextLeagueYear = data.meta.currentSplit === "Opening Split" ? data.meta.leagueYear : data.meta.leagueYear + 1;
  const nextSchedule = data.matches.filter((match) =>
    match.split === nextSplit && match.leagueYear === nextLeagueYear,
  );

  return <>
    <PageHeader
      eyebrow="Phase 9.5 · Continuity"
      title="Year Rollover / Continuity"
      description="Carries objective prior-split performance into proposed seeds, validates the next authoritative schedule, and preserves factual history without using seed as a tiebreaker."
    />
    <YearRolloverContinuityView
      completedThroughWeek={data.meta.appBaselineCompletedThroughWeek}
      leagueYear={data.meta.leagueYear}
      split={data.meta.currentSplit}
      standings={data.standings}
      matches={data.matches}
      results={data.results}
      matchupReference={data.matchupReference}
      hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate}
      nextSchedule={nextSchedule}
    />
  </>;
}
