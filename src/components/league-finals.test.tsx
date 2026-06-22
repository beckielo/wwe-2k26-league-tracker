// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrackerStateProvider } from "@/state/tracker-state-provider";
import { LEAGUE_NAMES, type StandingRow } from "@/domain/types";
import { LeagueFinals } from "./league-finals";

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league.split(" ")[0]} ${index + 1}`,
    seed: index + 1,
    matches: 22,
    wins: 22 - index,
    draws: 0,
    losses: index,
    points: (22 - index) * 3,
    status: "",
  })),
);

function renderFinals() {
  window.localStorage.clear();
  return render(
    <TrackerStateProvider>
      <LeagueFinals
        completedThroughWeek={22}
        leagueYear={2}
        split="Opening Split"
        standings={standings}
        matches={[]}
        results={[]}
        matchupReference={[]}
        hasLeagueFinalsTemplate
      />
    </TrackerStateProvider>,
  );
}

async function hydratedSelects() {
  await waitFor(() => expect(screen.queryByText(/Loading League Finals state/i)).toBeNull());
  return screen.getAllByRole("combobox");
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("League Finals result input", () => {
  it("enables Night One dropdowns with relegation winner and No Contest options", async () => {
    renderFinals();
    const selects = await hydratedSelects();
    expect(selects[0]).toBeEnabled();
    expect(within(selects[0]).getByRole("option", { name: "National 11 wins" })).toBeInTheDocument();
    expect(within(selects[0]).getByRole("option", { name: "Regional 2 wins" })).toBeInTheDocument();
    expect(within(selects[0]).getByRole("option", { name: "No Contest / unclear" })).toBeInTheDocument();
    expect(within(selects[0]).queryByRole("option", { name: /Draw/i })).toBeNull();
  });

  it("enables Save after selection and persists the saved result", async () => {
    renderFinals();
    const selects = await hydratedSelects();
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).toBeDisabled();
    fireEvent.change(selects[0], { target: { value: "National 11" } });
    expect(saveButtons[0]).toBeEnabled();
    fireEvent.click(saveButtons[0]);
    await waitFor(() => expect(screen.getByText("Saved: National 11 wins")).toBeInTheDocument());
    expect(saveButtons[0]).toBeDisabled();
  });

  it("keeps Night One completion disabled until all six Night One results are saved", async () => {
    renderFinals();
    const selects = await hydratedSelects();
    const nightOneComplete = screen.getByRole("button", { name: "Mark Night One complete" });
    expect(nightOneComplete).toBeDisabled();
    for (let index = 0; index < 6; index += 1) {
      fireEvent.change(selects[index], { target: { value: (selects[index] as HTMLSelectElement).options[1].value } });
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[index]);
    }
    await waitFor(() => expect(nightOneComplete).toBeEnabled());
  });

  it("updates the Elite Cup Final after semifinals and gates Night Two completion on the final result", async () => {
    renderFinals();
    const selects = await hydratedSelects();
    const nightTwoComplete = screen.getByRole("button", { name: "Mark Night Two complete" });
    expect(screen.getByText(/Winner SF1/)).toBeInTheDocument();
    expect(selects[11]).toBeDisabled();

    for (let index = 6; index < 11; index += 1) {
      fireEvent.change(selects[index], { target: { value: (selects[index] as HTMLSelectElement).options[1].value } });
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[index]);
    }

    await waitFor(() => expect(screen.getByRole("heading", { name: /Global 1 vs Global 2/i })).toBeInTheDocument());
    expect(nightTwoComplete).toBeDisabled();
    expect(selects[11]).toBeEnabled();
    fireEvent.change(selects[11], { target: { value: "Global 1" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[11]);
    await waitFor(() => expect(nightTwoComplete).toBeEnabled());
  });
});
