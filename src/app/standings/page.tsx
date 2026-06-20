import { PageHeader, Panel } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import Link from "next/link";
import { LEAGUE_NAMES } from "@/domain/types";

function zoneClass(rank: number) {
  if (rank === 1) return "border-l-emerald-400";
  if (rank <= 4) return "border-l-sky-400";
  if (rank >= 9 && rank <= 11) return "border-l-amber-400";
  if (rank === 12) return "border-l-red-500";
  return "border-l-transparent";
}

export const dynamic = "force-dynamic";

export default function StandingsPage() {
  const data = loadTrackerData();
  return <>
    <PageHeader
      eyebrow={`Through Week ${data.meta.currentWeek}`}
      title="All Standings"
      description="Records and points are imported from Standings_Current and reconciled against the completed schedule results. Zone labels are source values and remain provisional until clinching is explicitly encoded."
      aside={<Link href="/live-standings" className="action-button action-primary">Open Live Table</Link>}
    />
    <div className="space-y-8">
      {LEAGUE_NAMES.map((league) => {
        const rows = data.standings.filter((row) => row.league === league).sort((a,b) => a.rank-b.rank);
        return <Panel key={league}>
          <div className="flex items-end justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">12-wrestler division</p><h2 className="mt-1 text-2xl font-black uppercase">{league}</h2></div><p className="text-xs text-slate-500">P W D L · 3/1/0 points</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-sm">
            <thead className="bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Wrestler</th><th className="px-3 py-3">Seed</th><th className="px-3 py-3">P</th><th className="px-3 py-3">W</th><th className="px-3 py-3">D</th><th className="px-3 py-3">L</th><th className="px-3 py-3">Pts</th><th className="px-4 py-3 text-left">Current zone</th></tr></thead>
            <tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.wrestler} className={`border-l-2 ${zoneClass(row.rank)} hover:bg-white/[.025]`}><td className="px-4 py-3 font-black text-slate-500">{row.rank}</td><td className="px-4 py-3 font-bold">{row.wrestler}</td><td className="px-3 py-3 text-center text-slate-500">{row.seed}</td><td className="px-3 py-3 text-center">{row.matches}</td><td className="px-3 py-3 text-center">{row.wins}</td><td className="px-3 py-3 text-center">{row.draws}</td><td className="px-3 py-3 text-center">{row.losses}</td><td className="px-3 py-3 text-center text-lg font-black">{row.points}</td><td className="px-4 py-3 text-xs text-slate-400">{row.status}</td></tr>)}</tbody>
          </table></div>
        </Panel>;
      })}
    </div>
  </>;
}
