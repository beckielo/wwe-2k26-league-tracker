import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.5 UI wiring", () => {
  it("renders the dedicated live standings page with all four league panels and user-league highlighting", () => {
    const page = source("src/app/live-standings/page.tsx");
    const component = source("src/components/live-standings.tsx");
    expect(page).toContain("<LiveStandings");
    expect(component).toContain("LEAGUE_NAMES.map");
    expect(component).toContain("is-user-league");
    expect(component).toContain("calculateLiveStandingsFromCurrentMaster");
  });

  it("keeps the detailed standings route and adds Live Standings navigation", () => {
    expect(source("src/app/standings/page.tsx")).toContain("All Standings");
    expect(source("src/components/app-shell.tsx")).toContain('["Live Standings", "/live-standings"');
  });

  it("keeps analysis and management routes internal while mobile More exposes only core competition workflows", () => {
    const shell = source("src/components/app-shell.tsx");
    expect(shell).toContain("const internalNavigationGroups");
    expect(shell).toContain("internalOnly: true");
    expect(shell).toContain("const mobileMoreItems");
    expect(shell).toContain(".slice(4)");
    expect(shell).toContain("{navigationGroups.map");
    expect(shell).not.toContain("{internalNavigationGroups.map");
  });

  it("does not show a full schedule validation error wall before validation is requested", () => {
    const scheduleSetup = source("src/components/schedule-setup.tsx");
    expect(scheduleSetup).toContain("validationAttempted");
    expect(scheduleSetup).toContain("{validationAttempted && <section");
    expect(scheduleSetup).toContain("validation issues · Review details");
    expect(scheduleSetup).toContain("<details");
  });

  it("defines league classes plus enabled, pressed, hover, and disabled button states", () => {
    const css = source("src/app/globals.css");
    for (const league of ["global", "continental", "national", "regional"]) {
      expect(css).toContain(`.league-${league}`);
    }
    expect(css).toContain("button:not(:disabled):hover");
    expect(css).toContain("button:not(:disabled):active");
    expect(css).toContain("button:disabled");
    expect(css).toContain("cursor:not-allowed");
  });
});
