import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 11.1I full Live Standings equal card layout", () => {
  it("uses an equal two-column grid and shared full-card sizing model", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".live-league-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-flow:row; grid-auto-rows:1fr; gap:22px; align-items:stretch; }");
    expect(css).toContain("--full-live-card-header-height:104px");
    expect(css).toContain("--full-live-table-header-height:42px");
    expect(css).toContain("--full-live-table-row-height:52px");
    expect(css).toContain("min-height:calc(var(--full-live-card-header-height) + var(--full-live-table-header-height) + (12 * var(--full-live-table-row-height)) + var(--full-live-card-bottom-padding))");
    expect(css).not.toContain("transform:scale");
    expect(css).not.toContain("repeat(12,minmax(0,1fr))");
  });

  it("scopes fixed rows and status protection to the full live standings card variant", () => {
    const css = source("src/app/globals.css");
    const component = source("src/components/live-standings.tsx");

    expect(component).toContain("full-live-standings league-${visual.key}");
    expect(component).toContain("full-live-standings-row placement-${zone}");
    expect(css).toContain("grid-template-columns:50px minmax(150px,1fr) repeat(4,40px) 62px minmax(230px,.95fr)");
    expect(css).toContain(".live-table th:last-child,.live-table td:last-child { min-width:230px; overflow:visible; }");
    expect(css).toContain(".full-live-standings .zone-pill { flex:0 1 auto; min-width:0; overflow:visible; }");
    expect(css).not.toContain(".mini-standings-table-wrap { --live-standings-row-height");
    expect(css).not.toContain(".dashboard-live-table-wrap{--live-standings-row-height");
  });
});
