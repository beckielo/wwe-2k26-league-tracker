/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WrestlerNameWithRole } from "@/components/wrestler-name-with-role";
import { getLastCompletedAchievementMetadata, getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import type { CompletedSplitLegacyCommit } from "@/domain/tracker-state";

const liveStandingsSource = readFileSync("src/components/live-standings.tsx", "utf8");
const dashboardSource = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
const weekReviewSource = readFileSync("src/components/week-review.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

const currentFixtureCommit: CompletedSplitLegacyCommit = {
  sourceSignature: "phase-19ad-current-fixture",
  committedAt: "2026-06-24T00:00:00.000Z",
  leagueYear: 2,
  split: "Opening Split",
  titleRecords: [
    { league: "Global League Champion", wrestler: "Gunther" },
    { league: "Continental League Champion", wrestler: "Randy Orton" },
    { league: "National League Champion", wrestler: "LA Knight" },
    { league: "Regional League Champion", wrestler: "Dragon Lee" },
  ],
  eliteCupWinner: "Roman Reigns",
  eliteCupRunnerUp: "Gunther",
};

describe("Phase 19AD Continental Champion silver name color", () => {
  it("normalizes latest completed metadata including the Continental Champion fixture", () => {
    expect(getLastCompletedAchievementMetadata([currentFixtureCommit])).toMatchObject({
      globalChampion: "Gunther",
      continentalChampion: "Randy Orton",
      nationalChampion: "LA Knight",
      regionalChampion: "Dragon Lee",
      eliteCupWinner: "Roman Reigns",
    });
  });

  it("resolves the required achievement color priority independent of active league membership", () => {
    const roles = getPreviousSplitChampionColorRoles(undefined, [currentFixtureCommit]);
    const activeLeagueAfterPromotion = "Global League";

    expect(activeLeagueAfterPromotion).toBe("Global League");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "LA Knight", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Dragon Lee", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).not.toBe("double-winner");
  });

  it("renders only Randy Orton's wrestler name with the shared silver class instead of the default class", () => {
    const roles = getPreviousSplitChampionColorRoles(undefined, [currentFixtureCommit]);
    render(<WrestlerNameWithRole wrestler="Randy Orton" championRoles={roles} />);

    const renderedName = screen.getByText("Randy Orton");
    const wrapper = renderedName.closest(".wrestler-name-with-role");
    expect(wrapper?.classList.contains("name-color-continental-champion")).toBe(true);
    expect(wrapper?.classList.contains("name-color-normal")).toBe(false);
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-continental-champion{color:#d5dde8}");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-normal{color:#fff}");
  });

  it("keeps the corrected shared color helper wired into all existing wrestler-name surfaces", () => {
    expect(liveStandingsSource).toContain('<WrestlerNameWithRole wrestler={row.wrestler} currentUserWrestler={currentUserWrestler} championRoles={championRoles} />');
    expect(dashboardSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(dashboardSource).toContain("<DashboardShowWrestlerName wrestler={match.wrestlerA}");
    expect(dashboardSource).toContain("<DashboardShowWrestlerName wrestler={match.wrestlerB}");
    expect(weekReviewSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(liveStandingsSource).toContain('<td><span className="rank-badge">{row.rank}</span></td>');
    expect(dashboardSource).toContain("<td>{row.rank}</td><td><strong><WrestlerNameWithRole");
    expect(weekReviewSource).toContain('<td className="mini-standings-rank">{row.rank}</td>');
  });
});
