import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 11.1H full Live Standings natural card layout", () => {
  it("uses a natural two-column grid without stretching cards to equal row height", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".live-league-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-flow:row; grid-auto-rows:auto; gap:22px; align-items:start; }");
    expect(css).toContain(".live-league-panel { --zone:#68778a; display:flex; align-self:start; flex-direction:column; min-height:0; height:auto;");
    expect(css).not.toContain(".live-league-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-flow:row; grid-auto-rows:minmax(0,auto); column-gap:22px; row-gap:22px; align-items:stretch; }");
    expect(css).not.toContain(".live-league-panel { --zone:#68778a; display:flex; align-self:stretch;");
    expect(css).not.toContain("transform:scale");
    expect(css).not.toContain("repeat(12,minmax(0,1fr))");
  });

  it("scopes readable fixed rows to the full live standings card variant", () => {
    const css = source("src/app/globals.css");
    const component = source("src/components/live-standings.tsx");

    expect(component).toContain("full-live-standings league-${visual.key}");
    expect(component).toContain("full-live-standings-row placement-${zone}");
    expect(css).toContain("--live-standings-row-height:52px");
    expect(css).toContain(".live-table tbody tr,.full-live-standings-row { min-height:var(--live-standings-row-height); height:var(--live-standings-row-height); }");
    expect(css).not.toContain(".mini-standings-table-wrap { --live-standings-row-height");
    expect(css).not.toContain(".dashboard-live-table-wrap{--live-standings-row-height");
  });
});
