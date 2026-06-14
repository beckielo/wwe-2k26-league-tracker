import { ScheduleSetupView } from "@/components/schedule-setup";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
export const dynamic = "force-dynamic";
export default function ScheduleSetupPage() { const data = loadTrackerData(); return <><PageHeader eyebrow="Phase 9.6 · Continuity" title="Schedule Generator / Importer" description="Generates, imports, validates, exports, and safely promotes the next 22-week double-round-robin schedule without changing the source workbook." /><ScheduleSetupView leagueYear={data.meta.leagueYear} split={data.meta.currentSplit} completedThroughWeek={data.meta.appBaselineCompletedThroughWeek} standings={data.standings} matches={data.matches} results={data.results} matchupReference={data.matchupReference} hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate} userWrestler={data.meta.userWrestler} userLeague={data.meta.userLeague} /></>; }
