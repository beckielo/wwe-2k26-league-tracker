import { PageHeader, Panel } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { LEAGUE_NAMES } from "@/domain/types";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const data = loadTrackerData();
  const nextWeek = data.meta.appBaselineCompletedThroughWeek + 1;
  return <>
    <PageHeader eyebrow="Authoritative matchup reference" title={`Week ${nextWeek} Card`} description="Every pairing below is read from Matchup_Reference in workbook booking order. The application does not generate or repair fixtures." aside={<div className="border border-white/10 bg-white/5 px-4 py-3 text-sm"><span className="text-slate-500">Phase</span><strong className="ml-3">Rückrunde</strong></div>} />
    <div className="grid gap-6 xl:grid-cols-2">
      {LEAGUE_NAMES.slice().reverse().map((league) => {
        const matches = data.matchupReference.filter((match) => match.league === league && match.week === nextWeek).sort((a,b) => a.matchNumber-b.matchNumber);
        return <Panel key={league}>
          <div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-red-400">{matches[0]?.showDay}</p><h2 className="mt-1 text-xl font-black uppercase">{league}</h2></div><span className="text-xs text-slate-500">6 matches</span></div>
          <div className="divide-y divide-white/10">{matches.map((match) => <div key={match.matchNumber} className="grid grid-cols-[2rem_1fr] gap-3 px-5 py-4">
            <span className="text-xs font-black text-slate-600">{match.matchNumber}</span>
            <div><div className="flex items-center gap-2 font-bold"><span>{match.wrestlerA}</span><span className="text-[10px] italic text-red-400">VS</span><span>{match.wrestlerB}</span></div><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{match.sourceLabel} · {match.status}</p></div>
          </div>)}</div>
        </Panel>;
      })}
    </div>
  </>;
}
