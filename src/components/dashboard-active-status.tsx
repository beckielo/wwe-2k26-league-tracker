"use client";

import { PrimaryActionCard, Stat, WorkflowTimeline } from "./ui";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getWeekDisplay } from "@/domain/week-display";

export function DashboardActiveStatus() {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <div className="border border-white/10 p-5 text-slate-500">Loading workflow status…</div>;
  if (!state.activeWorkflow) return <Stat label="Current split" value="Opening" detail="Historical workbook workflow" />;
  const display = getWeekDisplay(state.activeWorkflow.leagueYear, state.activeWorkflow.yearWeek, state.activeWorkflow.split);
  return <>
    <Stat label="Current split" value="Closing Split" detail={display.primary} />
    <Stat label="Split week" value={display.splitWeek} detail={display.secondary} />
    <Stat label="User league" value={state.activeWorkflow.userLeague.replace(" League", "")} detail="Post-finals transition" />
    <Stat label="Schedule source" value={state.activeWorkflow.scheduleSource} detail="Accepted browser-local snapshot" />
  </>;
}

export function DashboardPhaseNotice() {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return null;
  if (!state.activeWorkflow) return <PrimaryActionCard title="Continue Opening Split workflow" description="Use the active authoritative card to complete the next user-controlled show." href="/results" action="Open Result Entry" />;
  const display = getWeekDisplay(state.activeWorkflow.leagueYear, state.activeWorkflow.yearWeek, state.activeWorkflow.split);
  return <div className="mt-8 space-y-6">
    <PrimaryActionCard eyebrow="Command Center" title={`Enter ${state.activeWorkflow.userLeague} results`} description={`${display.primary} is active. Select each winner, save the show, then review and lock the completed week.`} href="/results" action="Enter Results" tone="ready" />
    <WorkflowTimeline items={[
      { label: "Opening Split", status: "completed" }, { label: "Tiebreaker Review", status: "completed" },
      { label: "League Finals", status: "completed" }, { label: "Post-Finals", status: "completed" },
      { label: "Schedule Setup", status: "completed" }, { label: "Closing Split", status: "current" },
      { label: "Year Rollover", status: "locked" },
    ]} />
  </div>;
}
