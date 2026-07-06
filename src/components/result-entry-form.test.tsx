// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackerState } from "@/domain/tracker-state";
import type { Match } from "@/domain/types";
import { ResultEntryForm } from "./result-entry-form";

const replaceState = vi.fn();
const state: TrackerState = {
  version: 1,
  confirmedResults: [],
  completedWeeks: [],
  lastExportedAt: null,
  lastImportedAt: null,
};

vi.mock("@/state/tracker-state-provider", () => ({
  useTrackerState: () => ({
    state,
    replaceState,
    hydrated: true,
  }),
}));

function matches(): Match[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `national-37-${index + 1}`,
    leagueYear: 2,
    split: "Closing Split",
    week: 37,
    roundType: "RÃ¼ckrunde",
    league: "National League",
    showDay: "Dienstag",
    matchNumber: index + 1,
    wrestlerA: `Wrestler A${index + 1}`,
    wrestlerB: `Wrestler B${index + 1}`,
    matchupKey: `Wrestler A${index + 1} vs Wrestler B${index + 1}`,
    status: "scheduled",
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  }));
}

describe("ResultEntryForm winner selection", () => {
  afterEach(cleanup);

  beforeEach(() => {
    replaceState.mockClear();
  });

  it.each([
    ["Wrestler A1", "Winner"],
    ["Wrestler B1", "Winner"],
    ["Draw", "Draw"],
    ["No Contest", "No Contest"],
  ])("shows a selected state for %s", (label, value) => {
    render(<ResultEntryForm matches={matches()} userLeague="National League" />);
    const radio = screen.getByRole("radio", { name: new RegExp(label) });

    fireEvent.click(radio);

    expect(radio).toBeChecked();
    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(radio.closest("label")).toHaveAttribute("data-selected", "true");
    expect(radio.closest("label")).toHaveTextContent("Selected");
    expect(radio).toHaveAttribute("value", value === "Winner" ? label : value);
  });

  it("preserves an unsaved choice while moving between matches", () => {
    render(<ResultEntryForm matches={matches()} userLeague="National League" />);

    fireEvent.click(screen.getByRole("radio", { name: /Draw/ }));
    fireEvent.click(screen.getByRole("option", { name: /Match 02/ }));
    expect(screen.getByRole("radio", { name: /Wrestler A2/ })).toBeChecked();

    fireEvent.click(screen.getByRole("option", { name: /Match 01/ }));
    expect(screen.getByRole("radio", { name: /Draw/ })).toBeChecked();
  });

  it("shows all six matches as one visual selector without a matchup dropdown", () => {
    const { container } = render(<ResultEntryForm matches={matches()} userLeague="National League" />);

    const selector = screen.getByRole("listbox", { name: "Scheduled matchups" });
    expect(within(selector).getAllByRole("option")).toHaveLength(6);
    expect(container.querySelector("select#match")).not.toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: /Match 01/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(selector).getByRole("option", { name: /Match 03/ }));
    expect(within(selector).getByRole("option", { name: /Match 03/ })).toHaveAttribute("aria-selected", "true");
    expect(within(selector).getByRole("option", { name: /Match 01/ })).toHaveAttribute("aria-selected", "false");
  });

  it("uses focusable native radio controls for keyboard users", () => {
    render(<ResultEntryForm matches={matches()} userLeague="National League" />);
    const noContest = screen.getByRole("radio", { name: /No Contest/ });

    noContest.focus();

    expect(noContest).toHaveFocus();
  });
});
