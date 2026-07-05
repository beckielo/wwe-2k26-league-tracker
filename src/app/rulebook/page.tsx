import { PageHeader, Panel, PhaseBadge } from "@/components/ui";

const sections = [
  ["Source hierarchy", "Saved league data controls the current competition state. Active rules control scoring and workflow. Contradictions are marked Review Required and are never silently resolved."],
  ["League format and scoring", "Four 12-wrestler leagues play a 22-week double round robin per split. A win is 3 points, a draw is 1 point, and a loss is 0 points."],
  ["Tiebreakers", "Two-wrestler ties use points, head-to-head, longest winning streak, then a tiebreaker match. Multi-wrestler handling follows the Phase 8.1 rule and never uses seed."],
  ["Promotion, relegation, and League Finals", "Final standings determine champions and direct movement; authoritative League Finals matchups determine playoff movement and the separate Global Elite Cup."],
  ["Seed continuity", "Next-split seeds follow resolved post-finals composition and prior final facts. Seeds never resolve competition outcomes."],
  ["Schedule generation / import", "Only supplied schedules or explicitly accepted and validated generated/imported schedules may be activated. Matchups are never guessed."],
  ["Manual Review / Unclear Result", "Normal entry is winner/loser only. A user may explicitly open Manual Review with a note. Open reviews block affected locks and transitions; they do not invent a result, finish type, or scoring outcome."],
] as const;

export default function RulebookPage() {
  return <>
    <PageHeader eyebrow="Current competition rules" title="Rulebook / Changelog" description="Current active rule summary. This page does not edit rules or saved league data." />
    <div className="grid gap-5 lg:grid-cols-2">{sections.map(([title, body], index) => <Panel key={title} className="p-6"><PhaseBadge>Rule {String(index + 1).padStart(2, "0")}</PhaseBadge><h2 className="mt-4 text-xl font-black uppercase">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{body}</p></Panel>)}</div>
    <Panel className="mt-6 p-6"><PhaseBadge>Review policy</PhaseBadge><h2 className="mt-4 text-xl font-black uppercase">Open rule questions</h2><p className="mt-3 text-sm leading-6 text-slate-300">Rules that still need confirmation remain marked for review and are never resolved by assumption.</p></Panel>
  </>;
}
