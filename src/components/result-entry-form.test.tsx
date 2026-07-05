// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    const matchup = screen.getByLabelText("Scheduled matchup");

    fireEvent.click(screen.getByRole("radio", { name: /Draw/ }));
    fireEvent.change(matchup, { target: { value: "national-37-2" } });
    expect(screen.getByRole("radio", { name: /Wrestler A2/ })).toBeChecked();

    fireEvent.change(matchup, { target: { value: "national-37-1" } });
    expect(screen.getByRole("radio", { name: /Draw/ })).toBeChecked();
  });

  it("keeps all six matches available without the redundant matchup button box", () => {
    const { container } = render(<ResultEntryForm matches={matches()} userLeague="National League" />);

    expect(screen.getByLabelText("Scheduled matchup").querySelectorAll("option")).toHaveLength(6);
    expect(container.querySelector(".result-match-selector")).not.toBeInTheDocument();
  });

  it("uses focusable native radio controls for keyboard users", () => {
    render(<ResultEntryForm matches={matches()} userLeague="National League" />);
    const noContest = screen.getByRole("radio", { name: /No Contest/ });

    noContest.focus();

    expect(noContest).toHaveFocus();
  });
});
