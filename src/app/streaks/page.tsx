import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { LEAGUE_NAMES } from "@/domain/types";

export const dynamic = "force-dynamic";

export default function StreaksPage() {
  const data = loadTrackerData();
  const analytics = data.historicalAnalytics;
  const leader = [...data.streaks].sort((a, b) => b.longestWinningStreak - a.longestWinningStreak)[0];
  return <>
    <PageHeader
      eyebrow="Tiebreak criterion three"
      title="Streak Tracker"
      description={`Current and longest winning streaks are calculated only from validated League Year ${analytics.leagueYear} ${analytics.split} results. A draw ends a winning streak; unresolved and no-contest outcomes remain neutral under the existing rule.`}
    />
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <Stat label="Current-split leader" value={leader?.wrestler ?? "Pending"} detail={`${leader?.longestWinningStreak ?? 0} consecutive wins`} />
      <Stat label="Validated wrestlers" value={data.streaks.length} detail={`${analytics.resultCount} accepted results`} />
      <Stat label="Data through" value={`Split Week ${analytics.completedThroughSplitWeek}`} detail={`League Year ${analytics.leagueYear} · Year Week ${analytics.completedThroughYearWeek}`} />
    </div>
    {analytics.winningStreakSheetStatus === "reconstructed" && <div className="mb-6 border border-sky-400/30 bg-sky-400/10 p-4 text-sm text-sky-100">Winning streak records were refreshed to match the current split.</div>}
    <div className="grid gap-6 xl:grid-cols-2">{LEAGUE_NAMES.map((league) => <Panel key={league}><div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Winning runs</p><h2 className="mt-1 text-xl font-black uppercase">{league}</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-3 text-left">Wrestler</th><th className="px-3 py-3">Current</th><th className="px-3 py-3">Longest</th><th className="px-4 py-3 text-left">Last</th></tr></thead><tbody className="divide-y divide-white/10">{data.streaks.filter((row) => row.league === league).sort((a,b) => b.longestWinningStreak-a.longestWinningStreak || b.currentStreak-a.currentStreak).map((row) => <tr key={row.wrestler} className="hover:bg-white/[.025]"><td className="px-4 py-3 font-bold">{row.wrestler}</td><td className="px-3 py-3 text-center text-lg font-black text-red-300">{row.currentStreak}</td><td className="px-3 py-3 text-center text-lg font-black">{row.longestWinningStreak}</td><td className="px-4 py-3 text-slate-400">{row.lastResult}</td></tr>)}</tbody></table></div></Panel>)}</div>
  </>;
}
