import { LegacyTable } from "@/components/legacy-table";
import { Stat } from "@/components/ui";
import { loadLegacyTableData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default function LegacyPage() {
  const data = loadLegacyTableData();
  const tiered = data.profiles.filter((profile) => profile.goatStatusTier).length;
  const champions = data.profiles.filter((profile) => profile.leagueWinsTotal > 0).length;
  const cupWinners = data.profiles.filter((profile) => profile.eliteCupWins > 0).length;
  return <>
    <header className="legacy-hero">
      <div className="legacy-hero-mark" aria-hidden>Ⅰ</div>
      <div><p className="eyebrow">Workbook-backed career archive</p><h1>Legacy Table</h1><p>{data.subtitle}</p></div>
      <div className="legacy-source"><span>Current source</span><strong>{data.sourceSheet}</strong><small>{data.sourceFile}</small></div>
    </header>
    <div className="legacy-stats">
      <Stat label="Ranked profiles" value={data.profiles.length} detail="All populated workbook rows" />
      <Stat label="Source tiers" value={tiered} detail="Displayed exactly as recorded" />
      <Stat label="League winners" value={champions} detail="Recorded title totals only" />
      <Stat label="Elite Cup winners" value={cupWinners} detail="Recorded event wins only" />
    </div>
    <p className="legacy-policy">{data.policyNote}</p>
    <LegacyTable profiles={data.profiles} />
  </>;
}
