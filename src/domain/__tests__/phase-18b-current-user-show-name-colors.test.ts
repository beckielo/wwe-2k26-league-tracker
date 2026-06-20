import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole } from "../previous-split-name-colors";
import type { LegacyCompletedSplitAudit } from "../legacy";

const dashboardSource = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
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

describe("Phase 18B current user show name colors", () => {
  it("resolves previous split champion and Elite Cup color roles with current user override", () => {
    const roles = getPreviousSplitChampionColorRoles(audit());

    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Roman Reigns", championRoles: roles })).toBe("elite-cup");
    expect(getPreviousSplitNameColorRole({ wrestler: "Randy Orton", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", currentUserWrestler: "Gunther", championRoles: roles })).toBe("current-user");
  });

  it("resolves a Global Champion and Elite Cup double winner to purple role", () => {
    const roles = getPreviousSplitChampionColorRoles(audit("Gunther", "Gunther"));
    expect(getPreviousSplitNameColorRole({ wrestler: "Gunther", championRoles: roles })).toBe("double-winner");
  });

  it("wires scoped dashboard name classes and action links without changing routes", () => {
    expect(dashboardSource).toContain("dashboard-show-wrestler-name");
    expect(dashboardSource).toContain("name-color-current-user");
    expect(dashboardSource).toContain("getPreviousSplitNameColorRole");
    expect(dashboardSource).toContain('const nextHref = card.length ? "/results" : "/schedule-setup";');
    expect(dashboardSource).toContain('href="/simulation"');
    expect(dashboardSource).toContain('href="/week-review"');
    expect(dashboardSource).toContain("dashboard-workflow-actions-spaced");
  });

  it("defines readable scoped colors for current user, normal, champions, cup, and double winner", () => {
    expect(cssSource).toContain(".dashboard-show-wrestler-name.name-color-current-user{color:#05070a}");
    expect(cssSource).toContain(".dashboard-show-wrestler-name.name-color-normal{color:#fff}");
    expect(cssSource).toContain(".dashboard-show-wrestler-name.name-color-global-champion{color:#f3c969}");
    expect(cssSource).toContain(".dashboard-show-wrestler-name.name-color-elite-cup{color:#ef6a6a}");
    expect(cssSource).toContain(".dashboard-show-wrestler-name.name-color-double-winner{color:#b987f5}");
  });
});
