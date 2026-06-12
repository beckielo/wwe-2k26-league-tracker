import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { decideTwoWrestlerTiebreak, detectPointTies } from "@/domain/tiebreakers";

export const dynamic = "force-dynamic";

export default function TiebreakerCenterPage() {
  const data = loadTrackerData();
  const ties = detectPointTies(data.standings);
  const relevant = ties.filter((tie) => tie.relevant);
  const irrelevant = ties.filter((tie) => !tie.relevant);
  return <>
    <PageHeader eyebrow="League Year 2 decision desk" title="Tiebreaker Center" description="Tie order: points → head-to-head → longest winning streak → tiebreaker match. A match is required only if all three criteria remain tied. Seed is never an automatic tiebreaker." />
    <div className="mb-8 grid gap-4 sm:grid-cols-3"><Stat label="Point-tie groups" value={ties.length} detail="Current standings" /><Stat label="Relevant" value={relevant.length} detail="Cross a competitive boundary" /><Stat label="Not relevant" value={irrelevant.length} detail="Same status zone" /></div>
    <Panel className="mb-8"><div className="grid gap-px bg-white/10 md:grid-cols-4">{["1. Points", "2. Head-to-head", "3. Longest streak", "4. Match if still tied"].map((step) => <div key={step} className="bg-[#111722] p-5 text-sm font-black uppercase tracking-wide">{step}</div>)}</div></Panel>
    <div className="space-y-6">{ties.map((tie) => {
      const decision = tie.wrestlers.length === 2 ? decideTwoWrestlerTiebreak(tie.wrestlers[0], tie.wrestlers[1], data.headToHead, data.streaks) : null;
      return <Panel key={`${tie.league}-${tie.points}`}>
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center"><div><p className={`text-[10px] font-black uppercase tracking-[.2em] ${tie.relevant ? "text-amber-400" : "text-slate-500"}`}>{tie.relevant ? "Relevant tie" : "Irrelevant tie"}</p><h2 className="mt-1 text-xl font-black uppercase">{tie.league} · {tie.points} points</h2></div><span className={`w-fit border px-3 py-2 text-xs font-bold ${tie.relevant ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/5 text-slate-400"}`}>{tie.explanation}</span></div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.25fr]">
          <div className="space-y-2">{tie.wrestlers.map((row) => <div key={row.wrestler} className="flex items-center justify-between border border-white/10 bg-white/[.02] px-4 py-3"><span className="font-bold">#{row.rank} {row.wrestler}</span><span className="text-xs text-slate-500">{row.status}</span></div>)}</div>
          <div className="border-l-2 border-red-400 bg-red-400/5 p-4 text-sm leading-6 text-slate-300">{decision ? <><p className="font-black uppercase text-white">{decision.matchRequired ? "Tiebreaker match required" : `${decision.winner} leads`}</p><p>{decision.explanation}</p><p className="mt-2 text-xs text-slate-500">H2H {decision.headToHead.winsA}–{decision.headToHead.winsB} · Longest streak {decision.longestStreakA}–{decision.longestStreakB} · Seed ignored</p></> : <><p className="font-black uppercase text-amber-300">Multi-wrestler tie requires review</p><p>The source does not define a three-or-more-wrestler head-to-head aggregation formula. No mini-table or automatic winner is invented.</p></>}</div>
        </div>
      </Panel>;
    })}</div>
  </>;
}
