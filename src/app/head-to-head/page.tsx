import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { LEAGUE_NAMES } from "@/domain/types";

export const dynamic = "force-dynamic";

export default function HeadToHeadPage() {
  const data = loadTrackerData();
  const analytics = data.historicalAnalytics;
  return <>
    <PageHeader
      eyebrow="Validated current-split evidence"
      title="Head-to-Head Tracker"
      description={`Derived from the authoritative League Year ${analytics.leagueYear} ${analytics.split} schedule and completed results. Use this evidence after points when comparing two tied wrestlers; seed is never used as an automatic tiebreaker.`}
    />
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Completed records" value={data.headToHead.length} detail={`Through ${analytics.split} Week ${analytics.completedThroughSplitWeek}`} />
      <Stat label="Leagues covered" value={LEAGUE_NAMES.length} detail={`Year Week ${analytics.completedThroughYearWeek} checkpoint`} />
      <Stat label="Active order" value="Points → H2H" detail="Then longest streak" />
    </div>
    {analytics.headToHeadSheetStatus === "reconstructed" && <div className="mb-6 border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">The workbook H2H sheet was stale. This view safely uses the validated current-context reconstruction; no historical source was overwritten in memory.</div>}
    <div className="space-y-8">
      {LEAGUE_NAMES.map((league) => {
        const records = data.headToHead.filter((record) => record.league === league).sort((a, b) => b.week - a.week);
        return <Panel key={league}>
          <div className="flex items-end justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Result history</p><h2 className="mt-1 text-2xl font-black uppercase">{league}</h2></div><span className="text-xs text-slate-500">{records.length} completed</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-3 text-left">Split week</th><th className="px-4 py-3 text-left">Round</th><th className="px-4 py-3 text-left">Matchup</th><th className="px-4 py-3 text-left">Result</th></tr></thead><tbody className="divide-y divide-white/10">{records.map((record, index) => <tr key={`${record.week}-${record.wrestlerA}-${record.wrestlerB}-${index}`} className="hover:bg-white/[.025]"><td className="px-4 py-3 font-black text-slate-500">{record.week}</td><td className="px-4 py-3 text-slate-400">{record.roundType}</td><td className="px-4 py-3 font-bold">{record.wrestlerA} <span className="mx-2 text-xs italic text-red-400">VS</span> {record.wrestlerB}</td><td className={`px-4 py-3 ${record.winner ? "text-emerald-300" : "text-amber-200"}`}>{record.winner || "Draw"}</td></tr>)}</tbody></table></div>
        </Panel>;
      })}
    </div>
  </>;
}
