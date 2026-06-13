// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromoteCurrentMaster } from "./promote-current-master";
import type { TrackerState } from "@/domain/tracker-state";

vi.mock("@/domain/weekly-close-exports", () => ({
  createWeeklyCloseExports: () => ({
    ok: true,
    week: 16,
    package: {},
    packageJson: "{}",
    resultsCsv: "",
    standingsCsv: "",
  }),
}));

const props = {
  state: {} as TrackerState,
  allMatches: [],
  baselineStandings: [],
  userLeague: "National League" as const,
  workbookCompletedThroughWeek: 15,
  source: "master.xlsx",
};

function response(body: object, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PromoteCurrentMaster confirmation", () => {
  it("No, stay here does not run Git finalization", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      response({ filename: "W16.xlsx", backupFilename: "old.backup", week: 16, gitAutomationEnabled: true }),
    );
    render(<PromoteCurrentMaster {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /promote updated workbook/i }));
    await screen.findByText(/do you want to save this state to GitHub/i);
    fireEvent.click(screen.getByRole("button", { name: "No, stay here" }));
    expect(screen.queryByText(/do you want to save this state to GitHub/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Yes, save and continue calls finalization", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => response({ filename: "W16.xlsx", backupFilename: "old.backup", week: 16, gitAutomationEnabled: true }))
      .mockImplementationOnce(() => response({ ok: false, message: "Stopped for test", logs: [] }, false));
    render(<PromoteCurrentMaster {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /promote updated workbook/i }));
    await screen.findByText(/do you want to save this state to GitHub/i);
    fireEvent.click(screen.getByRole("button", { name: "Yes, save and continue" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/finalize-current-master");
  });

  it("shows the safe setup instruction when automation is disabled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      response({ filename: "W16.xlsx", backupFilename: "old.backup", week: 16, gitAutomationEnabled: false }),
    );
    render(<PromoteCurrentMaster {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /promote updated workbook/i }));
    expect(await screen.findByText(/Set ALLOW_LOCAL_GIT_AUTOMATION=true/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Yes, save and continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
