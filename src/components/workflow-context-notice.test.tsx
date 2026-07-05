// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TRACKER_STATE_STORAGE_KEY, createEmptyTrackerState } from "@/domain/tracker-state";
import type {
  WorkflowContextBaseline,
  WorkflowContextCandidate,
  WorkflowContextConflict,
} from "@/domain/workflow-context";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import { WorkflowContextNotice } from "./app-shell";

const dashboard: WorkflowContextCandidate = {
  source: "workbook-dashboard",
  valid: true,
  leagueYear: 2,
  split: "Closing Split",
  activeYearWeek: 37,
  completedThroughYearWeek: 36,
  splitWeek: 13,
  phase: "regular-season",
  scheduleSource: "Schedule_22W",
  standingsSource: "Standings_Current",
  resultsSource: "Schedule_22W",
  finalsReadiness: "not-ready",
  sourceSignature: "dashboard-closing-signature",
  confidence: "low",
  conflicts: [],
};

const appWorkbook: WorkflowContextCandidate = {
  ...dashboard,
  source: "app-workbook",
  scheduleSource: "App_Accepted_Schedule",
  standingsSource: "App_State_Standings",
  resultsSource: "App_Confirmed_Results",
  sourceSignature: "app-closing-signature",
  confidence: "high",
};

function context(app = appWorkbook): WorkflowContextBaseline {
  return {
    dashboard,
    appWorkbook: app,
    selected: "app-workbook",
    schedule: [],
    conflicts: app.conflicts,
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("WorkflowContextNotice severity UI", () => {
  it("shows ignored legacy browser state only as compact diagnostics", async () => {
    window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify({
      ...createEmptyTrackerState(),
      activeWorkflow: {
        leagueYear: 2,
        split: "Closing Split",
        yearWeek: 37,
        splitWeek: 13,
        scheduleSource: "accepted generated snapshot",
        acceptedScheduleAt: "legacy-session",
        activatedAt: "2026-07-04T00:00:00.000Z",
        userLeague: "National League",
      },
    }));

    const { container } = render(
      <TrackerStateProvider workflowContext={context()}>
        <WorkflowContextNotice />
      </TrackerStateProvider>,
    );

    await waitFor(() => expect(screen.getByText(/Saved data details/i)).toBeInTheDocument());
    expect(container.querySelector(".workflow-context-diagnostics")).toBeInTheDocument();
    expect(container.querySelector(".workflow-authority-notice")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Old browser session state was ignored. The app is using the validated Closing checkpoint.")).toBeInTheDocument();
    expect(screen.queryByText(/Import a validated backup or start a new workflow/i)).not.toBeInTheDocument();
  });

  it("keeps a real active-source conflict red and blocking", async () => {
    const activeConflict: WorkflowContextConflict = {
      code: "APP_ACTIVE_CONTEXT_INVALID",
      severity: "error",
      message: "The active App checkpoint is internally inconsistent.",
      sources: ["app-workbook"],
      recommendedAction: "Restore a coherent App checkpoint.",
    };
    const conflictedApp: WorkflowContextCandidate = {
      ...appWorkbook,
      confidence: "conflicted",
      conflicts: [activeConflict],
    };
    const { container } = render(
      <TrackerStateProvider workflowContext={context(conflictedApp)}>
        <WorkflowContextNotice />
      </TrackerStateProvider>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(container.querySelector(".workflow-authority-notice.has-blocking-conflict")).toBeInTheDocument();
    expect(screen.getByText(/The active App checkpoint is internally inconsistent/)).toBeInTheDocument();
    expect(screen.getByText(/Some saved data does not match the current week/)).toBeInTheDocument();
    expect(screen.queryByText(/app-closing-signature/)).not.toBeInTheDocument();
  });

  it("keeps a low-confidence workbook fallback visible without red styling", async () => {
    const fallback: WorkflowContextBaseline = {
      dashboard,
      appWorkbook: null,
      selected: "workbook-dashboard",
      schedule: [],
      conflicts: [],
    };
    const { container } = render(
      <TrackerStateProvider workflowContext={fallback}>
        <WorkflowContextNotice />
      </TrackerStateProvider>,
    );

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(container.querySelector(".workflow-authority-notice.confidence-low")).toBeInTheDocument();
    expect(container.querySelector(".has-blocking-conflict")).not.toBeInTheDocument();
  });
});
