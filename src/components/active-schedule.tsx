"use client";

import { Panel } from "./ui";
import { LEAGUE_NAMES, type Match } from "@/domain/types";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getWeekDisplay } from "@/domain/week-display";
import { detectActiveWeek } from "@/domain/week-progression";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";
import { WeekMatchPreview } from "./week-match-preview";

const SHOW_LABELS = {
  "Regional League": "Monday",
  "National League": "Tuesday",
  "Continental League": "Wednesday",
  "Global League": "Friday",
} as const;

export function ActiveSchedule({ workbookMatches, workbookCurrentWeek }: { workbookMatches: Match[]; workbookCurrentWeek: number }) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <p className="text-slate-500">Loading active schedule…</p>;
  const active = Boolean(state.activeWorkflow);
  const matches = getActiveWorkflowMatches(state, workbookMatches);
  const workflowBaseline = active ? 24 : workbookCurrentWeek;
  const week = detectActiveWeek(state, matches, workflowBaseline).activeWeek ?? state.activeWorkflow?.yearWeek ?? workbookCurrentWeek + 1;
  const display = getWeekDisplay(2, week, state.activeWorkflow?.split);
  const weekMatches = matches.filter((match) => match.week === week);
  return <>
    <div className="mb-6 border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
      <strong>{display.primary} Card</strong> · <span className="text-slate-500">{display.secondary}</span> · {active ? state.activeWorkflow?.scheduleSource : "Matchup_Reference"}
    </div>
    <WeekMatchPreview matches={weekMatches} sourceLabel={active ? state.activeWorkflow?.scheduleSource ?? "Accepted schedule snapshot" : "Matchup_Reference"} />
    <div className="grid gap-6 xl:grid-cols-2">
      {LEAGUE_NAMES.slice().reverse().map((league) => {
        const rows = matches.filter((match) => match.league === league && match.week === week).sort((a, b) => a.matchNumber - b.matchNumber);
        return <Panel key={league}>
          <div className="schedule-league-header"><LeagueDecorativeArt league={league} /><LeagueBrandMark league={league} usage="compact-badge" /><div><p>{SHOW_LABELS[league]}</p><h2>{league}</h2></div><span>{rows.length} matches</span></div>
          <div className="divide-y divide-white/10">{rows.map((match) => <div key={match.id} className="grid grid-cols-[2rem_1fr] gap-3 px-5 py-4"><span className="text-xs font-black text-slate-600">{match.matchNumber}</span><div><div className="flex items-center gap-2 font-bold"><span>{match.wrestlerA}</span><span className="text-[10px] italic text-red-400">VS</span><span>{match.wrestlerB}</span></div><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{active ? "Accepted snapshot · scheduled" : "Workbook reference · scheduled"}</p></div></div>)}</div>
        </Panel>;
      })}
    </div>
  </>;
}
