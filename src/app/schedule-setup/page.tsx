import { ScheduleSetupView } from "@/components/schedule-setup";
import { PageHeader } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
export const dynamic = "force-dynamic";
export default function ScheduleSetupPage() { const data = loadTrackerData(); return <><PageHeader eyebrow="Next split setup" title="Schedule Generator / Importer" description="Generate, import, validate, and accept the next 22-week double-round-robin schedule." /><ScheduleSetupView leagueYear={data.meta.leagueYear} split={data.meta.currentSplit} completedThroughWeek={data.meta.appBaselineCompletedThroughWeek} standings={data.standings} matches={data.matches} results={data.results} matchupReference={data.matchupReference} hasLeagueFinalsTemplate={data.hasLeagueFinalsTemplate} userWrestler={data.meta.userWrestler} userLeague={data.meta.userLeague} /></>; }
