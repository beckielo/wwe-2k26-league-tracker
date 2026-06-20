// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NewRunSetupWizard } from "./new-run-setup-wizard";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import type { TrackerMeta } from "@/domain/types";

const meta: TrackerMeta = {
  leagueYear: 2,
  leagueYearLabel: "League Year 2",
  currentSplit: "Closing Split",
  currentWeek: 20,
  latestAppWritebackWeek: null,
  latestAppWritebackCompletedAt: null,
  appBaselineCompletedThroughWeek: 19,
  usesAppWritebackSheets: false,
  currentStatus: "Current Rule Version",
  userLeague: "Global League",
  userWrestler: "Roman Reigns",
  nextUserShow: "Montag",
};

function renderWizard() {
  window.localStorage.clear();
  return render(<TrackerStateProvider><NewRunSetupWizard meta={meta} /></TrackerStateProvider>);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("NewRunSetupWizard", () => {
  it("renders the Create New Run button", async () => {
    renderWizard();
    expect(await screen.findByRole("button", { name: "Create New Run" })).toBeTruthy();
  });

  it("Cancel closes the warning without creating a draft", async () => {
    renderWizard();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Run" }));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Active run overwrite warning")).toBeNull();
    expect(window.localStorage.getItem("wwe-2k26-tracker-state-v1")).toBeNull();
  });

  it("records skipped backup choice and renders automatic preview with activation enabled", async () => {
    renderWizard();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Run" }));
    fireEvent.click(screen.getByRole("button", { name: "No, continue without backup" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to CAW setup" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Automatic" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview setup" }));
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Roster Count")).toBeTruthy();
    expect(screen.getByText("48 / 48")).toBeTruthy();
    expect(screen.getByText("Duplicates")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    for (const league of ["Global League", "Continental League", "National League", "Regional League"]) expect(screen.getByRole("heading", { name: league })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activate Fresh Run" })).toHaveProperty("disabled", false);
    await waitFor(() => expect(window.localStorage.getItem("wwe-2k26-tracker-state-v1")).toContain('"confirmedResults":[]'));
  });


  it("renders CAW badges and regenerates while keeping CAWs included", async () => {
    renderWizard();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Run" }));
    fireEvent.click(screen.getByRole("button", { name: "No, continue without backup" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to CAW setup" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.change(screen.getByPlaceholderText("Type CAW name"), { target: { value: "Beckielo" } });
    fireEvent.click(screen.getByRole("button", { name: "Add CAW" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Automatic" }));
    expect(screen.getByRole("button", { name: "Regenerate Random Roster" })).toBeTruthy();
    expect(screen.getByText("CAWs included")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("CAW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate Random Roster" }));
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("Beckielo")).toBeTruthy();
  });

  it("shows CAW duplicate validation", async () => {
    renderWizard();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Run" }));
    fireEvent.click(screen.getByRole("button", { name: "No, continue without backup" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to CAW setup" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.change(screen.getByPlaceholderText("Type CAW name"), { target: { value: "My CAW" } });
    fireEvent.click(screen.getByRole("button", { name: "Add CAW" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.change(screen.getByPlaceholderText("Type CAW name"), { target: { value: " my caw " } });
    fireEvent.click(screen.getByRole("button", { name: "Add CAW" }));
    expect(screen.getByText("my caw is already in the CAW list.")).toBeTruthy();
  });
});
