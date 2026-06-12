import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { calculateWinningStreaks } from "@/domain/tiebreakers";
import { LEAGUE_NAMES } from "@/domain/types";

export const dynamic = "force-dynamic";

export default function StreaksPage() {
  const data = loadTrackerData();
  const calculated = calculateWinningStreaks(data.matches, data.results);
  const calculatedByWrestler = new Map(calculated.map((row) => [`${row.league}:${row.wrestler}`, row]));
  const leader = [...data.streaks].sort((a, b) => b.longestWinningStreak - a.longestWinningStreak)[0];
  const mismatches = data.streaks.filter((row) => {
    const value = calculatedByWrestler.get(`${row.league}:${row.wrestler}`);
    return !value || value.currentWinningStreak !== row.currentStreak || value.longestWinningStreak !== row.longestWinningStreak;
  });
  return <>
    <PageHeader eyebrow="Tiebreak criterion three" title="Streak Tracker" description="Current and longest winning streaks are read from Winning_Streaks and independently recalculated from completed scheduled results. A non-win ends a winning streak; unresolved/no-contest outcomes are not inferred." />
    <div className="mb-8 grid gap-4 sm:grid-cols-3"><Stat label="Overall leader" value={leader.wrestler} detail={`${leader.longestWinningStreak} consecutive wins`} /><Stat label="Reconciled wrestlers" value={`${data.streaks.length - mismatches.length}/${data.streaks.length}`} detail="Workbook vs results" /><Stat label="Current week" value={data.meta.currentWeek} detail={data.meta.currentSplit} /></div>
    {mismatches.length > 0 && <div className="mb-6 border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{mismatches.length} streak records differ from the completed-result calculation and need source review.</div>}
    <div className="grid gap-6 xl:grid-cols-2">{LEAGUE_NAMES.map((league) => <Panel key={league}><div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">Winning runs</p><h2 className="mt-1 text-xl font-black uppercase">{league}</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-3 text-left">Wrestler</th><th className="px-3 py-3">Current</th><th className="px-3 py-3">Longest</th><th className="px-4 py-3 text-left">Last</th></tr></thead><tbody className="divide-y divide-white/10">{data.streaks.filter((row) => row.league === league).sort((a,b) => b.longestWinningStreak-a.longestWinningStreak || b.currentStreak-a.currentStreak).map((row) => <tr key={row.wrestler} className="hover:bg-white/[.025]"><td className="px-4 py-3 font-bold">{row.wrestler}</td><td className="px-3 py-3 text-center text-lg font-black text-red-300">{row.currentStreak}</td><td className="px-3 py-3 text-center text-lg font-black">{row.longestWinningStreak}</td><td className="px-4 py-3 text-slate-400">{row.lastResult}</td></tr>)}</tbody></table></div></Panel>)}</div>
  </>;
}
