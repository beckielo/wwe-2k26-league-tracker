import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 11.1G full Live Standings row height repair", () => {
  it("uses fixed readable full-page row heights instead of flexible shrinking rows", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("--live-standings-row-height:52px");
    expect(css).toContain("--live-standings-header-height:40px");
    expect(css).toContain("grid-template-rows:repeat(12,var(--live-standings-row-height))");
    expect(css).toContain("height:var(--live-standings-row-height)");
    expect(css).not.toContain(".live-table tbody { min-height:0; grid-template-rows:repeat(12,minmax(0,1fr)); }");
    expect(css).not.toContain("transform:scale");
  });

  it("keeps the full Live Standings card grid and branding scoped away from mini standings", () => {
    const css = source("src/app/globals.css");
    const component = source("src/components/live-standings.tsx");

    expect(css).toContain(".live-league-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(css).toContain(".live-league-header { position:relative; overflow:hidden; display:flex; align-items:center; gap:15px; min-height:96px");
    expect(component).toContain('<LeagueDecorativeArt league={league} className="live-league-decoration" />');
    expect(component).toContain('<LeagueBrandMark league={league} usage="watermark" className="live-league-watermark" />');
    expect(css).not.toContain(".mini-standings-table-wrap { --live-standings-row-height");
  });
});
