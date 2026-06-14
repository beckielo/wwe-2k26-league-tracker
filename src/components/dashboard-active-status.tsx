"use client";

import Link from "next/link";
import { Stat } from "./ui";
import { useTrackerState } from "@/state/tracker-state-provider";

export function DashboardActiveStatus() {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <div className="border border-white/10 p-5 text-slate-500">Loading workflow status…</div>;
  if (!state.activeWorkflow) return <Stat label="Current split" value="Opening" detail="Historical workbook workflow" />;
  return <>
    <Stat label="Current split" value="Closing" detail="Closing Split Weeks 25–48" />
    <Stat label="Active year week" value="25" detail="Regular weekly workflow" />
    <Stat label="Split week" value="1" detail="First Closing Split regular week" />
    <Stat label="User league" value={state.activeWorkflow.userLeague.replace(" League", "")} detail="Post-finals transition" />
    <Stat label="Schedule source" value={state.activeWorkflow.scheduleSource} detail="Accepted browser-local snapshot" />
  </>;
}

export function DashboardPhaseNotice() {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return null;
  return state.activeWorkflow ? (
    <div className="mt-8 border border-emerald-400/30 bg-emerald-400/10 p-6">
      <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Active workflow</p>
      <h2 className="mt-2 text-2xl font-black uppercase">Closing Split · Week 25</h2>
      <p className="mt-2 text-slate-300">Opening Split completion and finals remain preserved as history. Week 25 now uses the accepted schedule snapshot.</p>
      <Link href="/results" className="mt-5 inline-block bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Enter Week 25 results →</Link>
    </div>
  ) : null;
}
