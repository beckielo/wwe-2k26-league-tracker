import { LegacyPageClient } from "@/components/legacy-page-client";
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
      <div><p className="eyebrow">Career archive</p><h1>Legacy Table</h1><p>All-time achievements with current {data.historicalAnalytics.split} league and streak updates.</p></div>
      <div className="legacy-source"><span>Archive mode</span><strong>All-time history</strong><small>Missing achievements are never inferred</small></div>
    </header>
    {data.policyNote && <p className="legacy-policy">{data.policyNote}</p>}
    {showDiagnostics && summary.diagnostics.length > 0 && <div className="legacy-diagnostics">{summary.diagnostics.map((diagnostic) => <p key={diagnostic}>{diagnostic}</p>)}{summary.audit?.sources.map((source) => <p key={source.source}><strong>{source.source}:</strong> {source.leagueTitleRecords} title records · {source.eliteCupRecords} Elite Cup records{source.notes.length ? ` — ${source.notes.join(" ")}` : ""}</p>)}</div>}
    <LegacyPageClient profiles={data.profiles} summary={summary} historicalAnalytics={data.historicalAnalytics} />
  </>;
}
