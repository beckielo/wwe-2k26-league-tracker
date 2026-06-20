import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole } from "../previous-split-name-colors";
import type { LegacyCompletedSplitAudit } from "../legacy";

const dashboardSource = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
const liveStandingsSource = readFileSync("src/components/live-standings.tsx", "utf8");
const weekReviewSource = readFileSync("src/components/week-review.tsx", "utf8");
const helperSource = readFileSync("src/components/wrestler-name-with-role.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

function audit(globalChampion = "Gunther", eliteCupWinner = "Roman Reigns"): LegacyCompletedSplitAudit {
  return {
    detectedCompletedSplits: ["2:Opening Split"],
    duplicateRecordsRemoved: 0,
    diagnostics: [],
    sources: [],
    leagueTitleRecords: [
      { leagueYear: 2, split: "Opening Split", league: "Global League", wrestler: globalChampion },
      { leagueYear: 2, split: "Opening Split", league: "Continental League", wrestler: "Cody Rhodes" },
      { leagueYear: 2, split: "Opening Split", league: "National League", wrestler: "Beckielo" },
      { leagueYear: 2, split: "Opening Split", league: "Regional League", wrestler: "Jey Uso" },
    ],
    eliteCupRecords: [
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: eliteCupWinner },
    ],
  };
}

describe("Phase 18C current user icon and name colors", () => {
  it("resolves previous split champion and Elite Cup color roles without a current user color override", () => {
    const roles = getPreviousSplitChampionColorRoles(audit());

    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("normal");
    expect(helperSource).toContain("isCurrentUserWrestler");
    expect(helperSource).toContain("current-user-controller-icon");
    expect(helperSource).not.toContain("name-color-current-user");
  });

  it("keeps the general double-winner rule while applying the temporary Roman/Gunther active display override", () => {
    const drewRoles = getPreviousSplitChampionColorRoles(audit("Drew McIntyre", "Drew McIntyre"));
    expect(getPreviousSplitNameColorRole({ wrestler: "Drew McIntyre", championRoles: drewRoles })).toBe("double-winner");

    const guntherRoles = getPreviousSplitChampionColorRoles(audit("Gunther", "Gunther"));
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: guntherRoles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: guntherRoles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: guntherRoles })).not.toBe("double-winner");
  });

  it("wires the shared wrestler-name helper into the requested UI surfaces only in wrestler cells", () => {
    expect(dashboardSource).toContain("<DashboardShowWrestlerName wrestler={match.wrestlerA}");
    expect(dashboardSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(liveStandingsSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(weekReviewSource).toContain("<WrestlerNameWithRole wrestler={row.wrestler}");
    expect(dashboardSource).toContain("<td>{row.rank}</td>");
    expect(liveStandingsSource).toContain('<td><span className="rank-badge">{row.rank}</span></td>');
    expect(weekReviewSource).toContain('<td className="mini-standings-rank">{row.rank}</td>');
  });

  it("keeps H2H underline separate from the current user icon", () => {
    expect(dashboardSource).toContain("h2h.shouldUnderlineLeft");
    expect(dashboardSource).toContain("h2h.shouldUnderlineRight");
    expect(dashboardSource).toContain("h2h-last-winner");
    expect(cssSource).toContain(".h2h-last-winner{text-decoration:underline");
  });


  it("scopes match-preview name rendering to the dashboard show box without forcing current user black", () => {
    expect(dashboardSource).toContain("function DashboardShowWrestlerName");
    expect(dashboardSource).toContain("dashboard-show-name-content");
    expect(dashboardSource).toContain("getPreviousSplitNameColorRole({ wrestler, championRoles })");
    expect(dashboardSource).toContain("isCurrentUserWrestler(wrestler, currentUserWrestler)");
    expect(cssSource).toContain(".dashboard-show-name-content.name-color-normal{color:#fff}");
    expect(cssSource).not.toContain("dashboard-show-name-content.name-color-current-user");
    expect(cssSource).not.toContain("color:#000");
  });

  it("renders the current-user controller icon in the show box without replacing names or prediction bars", () => {
    expect(dashboardSource).toContain('<span className="dashboard-show-name-text">{children}</span>');
    expect(dashboardSource).toContain('<ControllerIcon className="dashboard-show-current-user-icon" />');
    expect(cssSource).toContain(".dashboard-show-current-user-icon");
    expect(cssSource).toContain("width:12px");
    expect(dashboardSource).toContain("prediction-bars");
  });

  it("defines readable scoped colors and a cyan controller icon", () => {
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-normal{color:#fff}");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-global-champion{color:#f3c969}");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-elite-cup{color:#ef6a6a}");
    expect(cssSource).toContain(".wrestler-name-with-role.name-color-double-winner{color:#b987f5}");
    expect(cssSource).toContain(".current-user-controller-icon");
    expect(cssSource).toContain("color:#67e8f9");
    expect(cssSource).not.toContain("name-color-current-user");
  });
});
