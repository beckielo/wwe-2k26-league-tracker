import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { LEAGUE_NAMES } from "@/domain/types";

export const dynamic = "force-dynamic";

export default function HeadToHeadPage() {
  const data = loadTrackerData();
  return <>
    <PageHeader eyebrow="Completed match evidence" title="Head-to-Head Tracker" description="Every row comes from the workbook H2H_Tracker. Use this evidence after points when comparing two tied wrestlers; seed is never used as an automatic tiebreaker." />
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Completed records" value={data.headToHead.length} detail={`Through Week ${data.meta.currentWeek}`} />
      <Stat label="Leagues covered" value={LEAGUE_NAMES.length} detail="Workbook result history" />
      <Stat label="Active order" value="Points → H2H" detail="Then longest streak" />
    </div>
    <div className="space-y-8">
      {LEAGUE_NAMES.map((league) => {
        const records = data.headToHead.filter((record) => record.league === league).sort((a, b) => b.week - a.week);
        return <Panel key={league}>
          <div className="flex items-end justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Result history</p><h2 className="mt-1 text-2xl font-black uppercase">{league}</h2></div><span className="text-xs text-slate-500">{records.length} completed</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-3 text-left">Week</th><th className="px-4 py-3 text-left">Round</th><th className="px-4 py-3 text-left">Matchup</th><th className="px-4 py-3 text-left">Winner</th></tr></thead><tbody className="divide-y divide-white/10">{records.map((record, index) => <tr key={`${record.week}-${record.wrestlerA}-${record.wrestlerB}-${index}`} className="hover:bg-white/[.025]"><td className="px-4 py-3 font-black text-slate-500">{record.week}</td><td className="px-4 py-3 text-slate-400">{record.roundType}</td><td className="px-4 py-3 font-bold">{record.wrestlerA} <span className="mx-2 text-xs italic text-red-400">VS</span> {record.wrestlerB}</td><td className="px-4 py-3 text-emerald-300">{record.winner}</td></tr>)}</tbody></table></div>
        </Panel>;
      })}
    </div>
  </>;
}
