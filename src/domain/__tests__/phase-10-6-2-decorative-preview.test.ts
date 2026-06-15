import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_BRAND_ASSETS, LEAGUE_BRAND_ASSETS } from "../brand-assets";
import { LEAGUE_NAMES } from "../types";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.6.2 decorative assets and match preview", () => {
  it("keeps original posters primary and maps every compact badge to batch art", () => {
    for (const league of LEAGUE_NAMES) {
      const asset = LEAGUE_BRAND_ASSETS[league];
      expect(asset.assetPath).toMatch(/^\/brand-assets\/leagues\//);
      expect(asset.batchAssetPath).toMatch(/^\/brand-assets\/decorative\/batches\/deco-(gl|cl|nl|rl)-batch\.png$/);
      expect(asset.decorativeAssetPath).toMatch(/^\/brand-assets\/decorative\/leagues\/deco-(gl|cl|nl|rl)\.png$/);
    }
    expect(EVENT_BRAND_ASSETS["league-finals-night-one"].assetPath).toContain("/brand-assets/events/");
  });

  it("renders only supplied match fields and provides a right-edge next control", () => {
    const preview = source("src/components/week-match-preview.tsx");
    for (const field of ["activeMatch.split", "activeMatch.week", "activeMatch.league", "activeMatch.matchNumber", "activeMatch.wrestlerA", "activeMatch.wrestlerB", "activeMatch.showDay", "activeMatch.source.sheet"]) {
      expect(preview).toContain(field);
    }
    expect(preview).toContain('className="match-preview-next"');
    expect(preview).toContain('aria-label="Next Match"');
    expect(preview).toContain("setActiveIndex");
    expect(preview).not.toContain("Math.random");
  });

  it("places the full preview on Schedule and keeps Dashboard compact", () => {
    expect(source("src/components/active-schedule.tsx")).toContain("<WeekMatchPreview");
    expect(source("src/components/dashboard-control-center.tsx")).not.toContain("<WeekMatchPreview");
    expect(source("src/components/dashboard-control-center.tsx")).toContain("command-decorative-art");
  });

  it("uses decorative art as restrained supporting surfaces", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain(".match-preview-vignette");
    expect(css).toContain(".live-league-decoration");
    expect(css).toContain("opacity:.16");
    expect(source("src/components/league-finals.tsx")).toContain("<EventBrandPanel");
  });
});
