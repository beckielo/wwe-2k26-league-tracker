import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 18H current user-controlled show typography polish", () => {
  it("keeps dashboard show wrestler names large but explicitly non-italic", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain(".dashboard-show-wrestler-name{font-size:16px;line-height:1.08;font-family:var(--font-geist-sans),Arial,sans-serif;font-style:normal;font-weight:900");
    expect(css).toContain(".dashboard-show-name-content{display:inline;min-width:0;color:#fff;font-style:normal}");
    expect(css).toContain(".dashboard-show-name-content .dashboard-show-name-text{color:inherit;font-family:var(--font-geist-sans),Arial,sans-serif;font-size:16px;font-style:normal;font-weight:900");
  });

  it("renders H2H underlines on the wrestler name text where H2H marks a winner", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");

    expect(dashboard).toContain("h2h.shouldUnderlineLeft");
    expect(dashboard).toContain("h2h.shouldUnderlineRight");
    expect(dashboard).toContain("h2h-last-winner");
    expect(css).toContain('.h2h-last-winner .dashboard-show-name-text::after{content:"";position:absolute;right:0;bottom:0;left:0;height:2px');
    expect(css).toContain("background:#f6d98b");
  });

  it("keeps the dashboard show controller icon with larger scoped sizing and spacing", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");

    expect(dashboard).toContain('<ControllerIcon className="dashboard-show-current-user-icon" />');
    expect(css).toContain(".dashboard-show-current-user-icon{display:inline-block;width:15px;height:15px;margin-left:8px;vertical-align:-2px;text-decoration:none}");
    expect(css).toContain(".current-user-controller-icon{flex:0 0 auto;width:14px;height:14px");
  });
});
