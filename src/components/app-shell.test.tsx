// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkflowContextBaseline, WorkflowContextCandidate, WorkflowContextPhase } from "@/domain/workflow-context";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function workflowContext(phase: WorkflowContextPhase): WorkflowContextBaseline {
  const appWorkbook: WorkflowContextCandidate = {
    source: "app-workbook",
    valid: true,
    leagueYear: 2,
    split: "Closing Split",
    activeYearWeek: phase === "regular-season" ? 37 : phase === "split-complete" ? 47 : 48,
    completedThroughYearWeek: phase === "post-finals" ? 48 : phase === "regular-season" ? 36 : 46,
    splitWeek: phase === "regular-season" ? 13 : phase === "split-complete" ? 23 : 24,
    phase,
    scheduleSource: "App_Accepted_Schedule",
    standingsSource: "App_State_Standings",
    resultsSource: "App_Confirmed_Results",
    finalsReadiness: phase === "split-complete" || phase === "finals" ? "ready" : "not-ready",
    sourceSignature: `app-${phase}`,
    confidence: "high",
    conflicts: [],
  };
  return {
    dashboard: { ...appWorkbook, source: "workbook-dashboard", confidence: "low" },
    appWorkbook,
    selected: "app-workbook",
    schedule: [],
    conflicts: [],
  };
}

function renderShell(phase: WorkflowContextPhase) {
  return render(
    <TrackerStateProvider workflowContext={workflowContext(phase)}>
      <AppShell><div>Shell content</div></AppShell>
    </TrackerStateProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AppShell workflow navigation", () => {
  it("hides League Finals during the regular season while keeping other quick links", async () => {
    renderShell("regular-season");
    await waitFor(() => expect(screen.getByText("Shell content")).toBeInTheDocument());

    expect(screen.queryByRole("link", { name: "League Finals" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Schedule" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Calendar" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Calendar" }).every((link) => link.getAttribute("href") === "/calendar")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Simulation" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Week Review" }).length).toBeGreaterThan(0);
  });

  it.each(["split-complete", "finals", "post-finals"] as const)(
    "shows League Finals during the %s workflow phase",
    async (phase) => {
      renderShell(phase);
      await waitFor(() => expect(screen.getByText("Shell content")).toBeInTheDocument());
      expect(screen.getAllByRole("link", { name: "League Finals" }).length).toBeGreaterThan(0);
    },
  );

  it("removes the sidebar Current League box but keeps the active user league in context", async () => {
    const { container } = renderShell("regular-season");
    await waitFor(() => expect(screen.getByText("Shell content")).toBeInTheDocument());

    expect(container.querySelector(".sidebar-context")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Current league$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current user Beckielo, National League")).toBeInTheDocument();
  });
});
