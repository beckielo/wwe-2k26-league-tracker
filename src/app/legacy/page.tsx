import { LegacyTable } from "@/components/legacy-table";
import { Stat } from "@/components/ui";
import { loadLegacyTableData } from "@/data/workbook";

export const dynamic = "force-dynamic";

export default async function LegacyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const showDiagnostics = params?.debugLegacy === "1";
  const data = loadLegacyTableData();
  const { summary } = data;
  return <>
    <header className="legacy-hero">
      <div className="legacy-hero-mark" aria-hidden>Ⅰ</div>
      <div><p className="eyebrow">Workbook-backed career archive</p><h1>Legacy Table</h1><p>{data.subtitle}</p></div>
      <div className="legacy-source"><span>Current source</span><strong>{data.sourceSheet}</strong><small>{data.sourceFile}</small></div>
    </header>
    <div className="legacy-stats">
      <Stat label="Ranked profiles" value={summary.rankedProfiles} detail="All populated workbook rows" />
      <Stat label="Active tiers" value={summary.activeLegacyTiers} detail="S-D tier values currently used" />
      <Stat label="League title records" value={summary.leagueTitleRecords} detail="Recorded historical title total" />
      <Stat label="Elite Cup records" value={summary.eliteCupRecords} detail="Recorded historical event total" />
    </div>
    {data.policyNote && <p className="legacy-policy">{data.policyNote}</p>}
    {showDiagnostics && summary.diagnostics.length > 0 && <div className="legacy-diagnostics">{summary.diagnostics.map((diagnostic) => <p key={diagnostic}>{diagnostic}</p>)}{summary.audit?.sources.map((source) => <p key={source.source}><strong>{source.source}:</strong> {source.leagueTitleRecords} title records · {source.eliteCupRecords} Elite Cup records{source.notes.length ? ` — ${source.notes.join(" ")}` : ""}</p>)}</div>}
    <LegacyTable profiles={data.profiles} />
  </>;
}
