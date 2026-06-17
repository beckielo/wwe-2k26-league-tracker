import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEAGUE_BRAND_ASSETS } from "../brand-assets";
import { LEAGUE_NAMES } from "../types";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.6.1 brand and dashboard polish", () => {
  it("keeps full poster art out of compact league marks", () => {
    const component = source("src/components/brand-assets.tsx");
    expect(component).toContain('const fullImageUsages: readonly BrandUsage[] = ["hero", "panel", "watermark", "header"]');
    expect(component).toContain('data-brand-art={usesFullImage ? "full" : "monogram"}');
    expect(component).toContain("{usesFullImage && <ResilientBrandImage");
    expect(component).toContain("{usesBatchImage && <ResilientBrandImage");

    expect(LEAGUE_NAMES.map((league) => LEAGUE_BRAND_ASSETS[league].fallbackCrest)).toEqual(["GL", "CL", "NL", "RL"]);
  });

  it("uses compact foreground crests and one large watermark in Live Standings", () => {
    const component = source("src/components/live-standings.tsx");
    expect(component).toContain('<LeagueBrandMark league={league} usage="crest"');
    expect(component).toContain('<LeagueBrandMark league={league} usage="watermark" className="live-league-watermark"');
    expect(component).toContain("LEAGUE_NAMES.map");
    expect(component).not.toContain('usage="compact" className="live-league-watermark"');
  });

  it("uses compact dashboard marks and truthful current-card language", () => {
    const component = source("src/components/dashboard-control-center.tsx");
    expect(component).toContain('<LeagueBrandMark league={userLeague} usage="crest"');
    expect(component).toContain('<LeagueBrandMark league={userLeague} usage="compact"');
    expect(component).toContain('completed > 0 ? "In Progress" : "Ready"');
    expect(component).not.toContain("Action blocked");
    expect(component).toContain("Complete the ${userLeague} card");
  });

  it("summarizes non-blocking diagnostics as source warnings rather than errors", () => {
    const page = source("src/app/page.tsx");
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(page).not.toContain('errors.length + " errors"');
    expect(dashboard).toContain("Source Warnings");
    expect(dashboard).toContain("Non-blocking · details contained");
  });

  it("keeps Finals poster artwork in the larger event panel", () => {
    const finals = source("src/components/league-finals.tsx");
    const brand = source("src/components/brand-assets.tsx");
    expect(finals).toContain("<EventBrandPanel");
    expect(brand).toContain('className="event-brand-art"');
    expect(finals).not.toContain("event-brand-art");
  });
});
