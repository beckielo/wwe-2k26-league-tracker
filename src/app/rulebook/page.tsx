import { PageHeader, Panel, PhaseBadge } from "@/components/ui";

const sections = [
  ["Source hierarchy", "The workbook controls current game state. Active project rules control rules and workflow. Contradictions are Review Required and are never silently resolved."],
  ["League format and scoring", "Four 12-wrestler leagues play a 22-week double round robin per split. A win is 3 points, a draw is 1 point, and a loss is 0 points."],
  ["Tiebreakers", "Two-wrestler ties use points, head-to-head, longest winning streak, then a tiebreaker match. Multi-wrestler handling follows the Phase 8.1 rule and never uses seed."],
  ["Promotion, relegation, and League Finals", "Final standings determine champions and direct movement; authoritative League Finals matchups determine playoff movement and the separate Global Elite Cup."],
  ["Seed continuity", "Next-split seeds follow resolved post-finals composition and prior final facts. Seeds never resolve competition outcomes."],
  ["Schedule generation / import", "Only workbook schedules or explicitly accepted, fully validated generated/imported schedules may be activated. Matchups are never guessed."],
  ["Manual Review / Unclear Result", "Normal entry is winner/loser only. A user may explicitly open Manual Review with a note. Open reviews block affected locks and transitions; they do not invent a result, finish type, or scoring outcome."],
] as const;

export default function RulebookPage() {
  return <>
    <PageHeader eyebrow="Read-only traceability" title="Rulebook / Changelog" description="Current active rule summary. This page does not edit rules or workbook state." />
    <div className="grid gap-5 lg:grid-cols-2">{sections.map(([title, body], index) => <Panel key={title} className="p-6"><PhaseBadge>Rule {String(index + 1).padStart(2, "0")}</PhaseBadge><h2 className="mt-4 text-xl font-black uppercase">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{body}</p></Panel>)}</div>
    <Panel className="mt-6 p-6"><PhaseBadge>Traceability</PhaseBadge><h2 className="mt-4 text-xl font-black uppercase">Changelog & open assumptions</h2><p className="mt-3 text-sm leading-6 text-slate-300">The conflict register documents source hierarchy, unresolved encoding questions, and each implemented phase. See <code>docs/assumptions-and-conflicts.md</code>; this UI remains read-only.</p></Panel>
  </>;
}
