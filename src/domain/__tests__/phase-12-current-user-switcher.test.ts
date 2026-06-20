import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase 12 current user switcher UI wiring", () => {
  it("renders a controlled Current User selector with league context", () => {
    const component = readFileSync("src/components/current-user-switcher.tsx", "utf8");
    expect(component).toContain("aria-label=\"Current User\"");
    expect(component).toContain("<select");
    expect(component).toContain("Current League:");
    expect(component).toContain("option.wrestler} — {option.league}");
  });

  it("places the switcher above the dashboard command deck", () => {
    const dashboard = readFileSync("src/components/dashboard-control-center.tsx", "utf8");
    expect(dashboard.indexOf("<CurrentUserSwitcher standings={props.baselineStandings} />")).toBeGreaterThan(-1);
    expect(dashboard.indexOf("<CurrentUserSwitcher standings={props.baselineStandings} />")).toBeLessThan(dashboard.indexOf("<section className={`command-deck"));
  });
});
