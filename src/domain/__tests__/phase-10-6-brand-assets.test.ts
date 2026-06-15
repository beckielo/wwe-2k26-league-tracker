import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECORATIVE_ASSET_DIRECTORY, EVENT_BRAND_ASSETS, LEAGUE_BRAND_ASSETS } from "../brand-assets";
import { LEAGUE_NAMES } from "../types";
import { placementZone } from "../visual-identity";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.6 brand assets and live table polish", () => {
  it("registers all four league assets with fallback crests and usage levels", () => {
    expect(Object.keys(LEAGUE_BRAND_ASSETS)).toEqual(LEAGUE_NAMES);
    for (const league of LEAGUE_NAMES) {
      const asset = LEAGUE_BRAND_ASSETS[league];
      expect(asset.assetPath).toMatch(/^\/brand-assets\/leagues\/.+-league\.jpg$/);
      expect(asset.fallbackCrest).toHaveLength(2);
      expect(asset.usageVariants).toContain("compact-badge");
      expect(asset.usageVariants).toContain("match-preview-art");
      expect(asset.primaryColor).toMatch(/^#/);
    }
  });

  it("registers both League Finals event assets", () => {
    expect(EVENT_BRAND_ASSETS["league-finals-night-one"].assetPath).toBe("/brand-assets/events/league-finals-night-one.jpg");
    expect(EVENT_BRAND_ASSETS["league-finals-night-two"].assetPath).toBe("/brand-assets/events/league-finals-night-two.jpg");
  });

  it("uses an image error fallback and treats decorative assets as optional", () => {
    const component = source("src/components/brand-assets.tsx");
    expect(component).toContain("onError={() => setFailed(true)}");
    expect(component).toContain("brand-fallback");
    expect(DECORATIVE_ASSET_DIRECTORY).toBe("/brand-assets/decorative/");
    expect(component).not.toContain(DECORATIVE_ASSET_DIRECTORY);
  });

  it("keeps separate placement classes for 1–4 and 9–12 while sharing 5–8", () => {
    expect([1, 2, 3, 4].map(placementZone)).toEqual(["rank-1", "rank-2", "rank-3", "rank-4"]);
    expect([5, 6, 7, 8].map(placementZone)).toEqual(["mid-table", "mid-table", "mid-table", "mid-table"]);
    expect([9, 10, 11, 12].map(placementZone)).toEqual(["rank-9", "rank-10", "rank-11", "rank-12"]);
  });

  it("exposes Live Standings in navigation, Dashboard, and the detailed standings page", () => {
    expect(source("src/components/app-shell.tsx")).toContain('["Live Standings", "/live-standings"');
    expect(source("src/components/dashboard-control-center.tsx")).toContain("Open Live Table");
    expect(source("src/app/standings/page.tsx")).toContain('href="/live-standings"');
  });

  it("renders branded four-league tables and event panels with alt text", () => {
    expect(source("src/components/live-standings.tsx")).toContain("LEAGUE_NAMES.map");
    expect(source("src/components/live-standings.tsx")).toContain('<LeagueBrandMark league={league} usage="crest"');
    expect(source("src/components/league-finals.tsx")).toContain("<EventBrandPanel");
    expect(source("src/components/brand-assets.tsx")).toContain('alt={`${league} custom league logo`}');
    expect(source("src/components/brand-assets.tsx")).toContain('alt={`${asset.name} custom event logo`}');
  });

  it("defines shared radii and enabled versus disabled interaction states", () => {
    const css = source("src/app/globals.css");
    for (const token of ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"]) expect(css).toContain(token);
    expect(css).toContain(".interactive-panel:hover");
    expect(css).toContain("button:disabled");
    expect(css).toContain("cursor:not-allowed!important");
  });
});
