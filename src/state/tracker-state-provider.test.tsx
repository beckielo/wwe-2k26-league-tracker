// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TRACKER_STATE_STORAGE_KEY, createEmptyTrackerState } from "@/domain/tracker-state";
import type { WorkflowContextBaseline, WorkflowContextCandidate } from "@/domain/workflow-context";
import { TrackerStateProvider, useTrackerState } from "./tracker-state-provider";

const dashboard: WorkflowContextCandidate = {
  source: "workbook-dashboard",
  valid: true,
  leagueYear: 2,
  split: "Opening Split",
  activeYearWeek: 14,
  completedThroughYearWeek: 13,
  splitWeek: 14,
  phase: "regular-season",
  scheduleSource: "Schedule_22W",
  standingsSource: "Standings_Current",
  resultsSource: "Schedule_22W",
  finalsReadiness: "not-ready",
  sourceSignature: "dashboard-signature",
  confidence: "low",
  conflicts: [],
};
const appWorkbook: WorkflowContextCandidate = {
  ...dashboard,
  source: "app-workbook",
  leagueYear: 2,
  split: "Closing Split",
  activeYearWeek: 37,
  completedThroughYearWeek: 36,
  splitWeek: 13,
  scheduleSource: "App_Accepted_Schedule",
  standingsSource: "App_State_Standings",
  resultsSource: "App_Confirmed_Results",
  sourceSignature: "app-signature",
  confidence: "high",
};
const workflowContext: WorkflowContextBaseline = {
  dashboard,
  appWorkbook,
  selected: "app-workbook",
  schedule: [],
  conflicts: [],
};

function Probe() {
  const { authority, hydrated, state } = useTrackerState();
  return (
    <output>
      {hydrated ? "hydrated" : "pending"}|{authority.activeSource}|{authority.split}|
      {state.activeWorkflow ? "local-workflow-visible" : "local-workflow-hidden"}|
      {authority.confidence}|blocking:{authority.blockingConflicts.length}|
      diagnostics:{authority.diagnosticNotices.map((entry) => entry.code).join(",")}
    </output>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("TrackerStateProvider workflow authority hydration", () => {
  it("ignores an invalid persisted local workflow and exposes the coherent App checkpoint", async () => {
    window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify({
      ...createEmptyTrackerState(),
      activeWorkflow: {
        leagueYear: 2,
        split: "Closing Split",
        yearWeek: 47,
        splitWeek: 23,
        scheduleSource: "accepted generated snapshot",
        acceptedScheduleAt: "missing-schedule",
        activatedAt: "2026-07-04T00:00:00.000Z",
        userLeague: "National League",
      },
    }));
    render(<TrackerStateProvider workflowContext={workflowContext}><Probe /></TrackerStateProvider>);
    await waitFor(() => expect(screen.getByText(/hydrated\|app-workbook\|Closing Split/)).toBeInTheDocument());
    expect(screen.getByText(/local-workflow-hidden/)).toBeInTheDocument();
    expect(screen.getByText(/high\|blocking:0/)).toBeInTheDocument();
    expect(screen.getByText(/LOCAL_SCHEDULE_INVALID/)).toBeInTheDocument();
  });

  it("falls back to the App checkpoint after localStorage loss", async () => {
    render(<TrackerStateProvider workflowContext={workflowContext}><Probe /></TrackerStateProvider>);
    await waitFor(() => expect(screen.getByText(/hydrated\|app-workbook\|Closing Split/)).toBeInTheDocument());
    expect(screen.getByText(/local-workflow-hidden/)).toBeInTheDocument();
    expect(window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY)).toBeNull();
  });
});
