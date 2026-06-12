import { ResultEntryForm } from "@/components/result-entry-form";
import { PageHeader, Panel } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
  const data = loadTrackerData();
  const nextWeek = data.meta.currentWeek + 1;
  const matches = data.matches.filter((match) => match.league === data.meta.userLeague && match.week === nextWeek && match.status === "scheduled").sort((a,b) => a.matchNumber-b.matchNumber);
  return <>
    <PageHeader eyebrow="Schedule-locked input" title="Result Entry" description={`Validate a result against the authoritative ${data.meta.userLeague} Week ${nextWeek} card. Confirmed results are stored in browser-local tracker state and never modify the workbook.`} />
    <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <Panel><div className="border-b border-white/10 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">{data.meta.nextUserShow}</p><h2 className="mt-2 text-2xl font-black uppercase">Choose scheduled result</h2></div><ResultEntryForm matches={matches} userLeague={data.meta.userLeague} /></Panel>
      <Panel className="h-fit"><div className="border-b border-white/10 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">Phase 1 guardrails</p><h2 className="mt-2 text-2xl font-black uppercase">Validation policy</h2></div><ul className="space-y-4 p-6 text-sm leading-6 text-slate-300"><li>✓ Match ID must exist in the imported schedule.</li><li>✓ Duplicate confirmed results are rejected; existing results can be edited before week completion.</li><li>✓ Winner must be one of the scheduled wrestlers; Draw and No Contest have no winner.</li><li>✓ No free-form opponent or matchup creation.</li><li className="text-slate-500">Workbook writes remain disabled. Week completion locks confirmed results until explicitly unlocked.</li></ul></Panel>
    </div>
  </>;
}
