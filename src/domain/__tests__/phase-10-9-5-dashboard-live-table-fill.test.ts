import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) { return fs.readFileSync(path.join(process.cwd(), file), "utf8"); }

describe("Phase 10.9.5 dashboard user league live table fill polish", () => {
  it("keeps the Current User League Live Table rendering all league rows without slicing or collapsing details", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");

    expect(dashboard).toContain("<tbody>{rows.map((row) =>");
    expect(dashboard).not.toContain("rows.slice");
    expect(dashboard).toContain("<th>#</th><th>Wrestler</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>Status</th>");
    expect(dashboard).toContain("placementLabel(league, row.rank)");
  });

  it("uses a no-scroll flex table area that expands to fill the paired dashboard card", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".dashboard-equal-panels { --dashboard-panel-height:clamp(590px,64vh,660px); }");
    expect(css).toContain(".dashboard-equal-panel { height:var(--dashboard-panel-height); display:flex; flex-direction:column; min-height:0; }");
    expect(css).toContain(".dashboard-live-table-wrap{overflow:visible;max-height:none;flex:1;min-height:0;display:flex}");
    expect(css).toContain(".dashboard-live-table table{width:100%;height:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}");
    expect(css).toContain(".dashboard-live-table-compact tbody tr{height:calc(100% / 12)}");
    expect(css).not.toContain(".dashboard-live-table-wrap{overflow:auto");
  });

  it("preserves readable desktop table spacing while keeping content fully visible", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("padding:8px 5px;border-bottom:1px solid #ffffff0b;text-align:left;vertical-align:middle");
    expect(css).toContain("padding-top:9px;padding-bottom:9px");
    expect(css).toContain(".dashboard-live-table .zone-pill{display:inline-block;max-width:100%;white-space:normal;font-size:8px;line-height:1.08;padding:3px 5px}");
    expect(css).toContain("@media (max-width:1000px)");
  });
});
