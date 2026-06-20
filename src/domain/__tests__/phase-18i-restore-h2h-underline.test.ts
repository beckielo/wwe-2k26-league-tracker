import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 18I restored dashboard show H2H underline", () => {
  it("keeps H2H underline scoped to the H2H winner class and name text only", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");

    expect(dashboard).toContain('className={wrestlerNameClassName(h2h.shouldUnderlineLeft)}');
    expect(dashboard).toContain('className={wrestlerNameClassName(h2h.shouldUnderlineRight)}');
    expect(dashboard).toContain('isLastHeadToHeadWinner ? "h2h-last-winner" : null');
    expect(css).toContain('.h2h-last-winner .dashboard-show-name-text::after{content:"";position:absolute;right:0;bottom:0;left:0;height:2px');
    expect(css).not.toContain('}.dashboard-show-name-text::after{content:""');
  });

  it("preserves dashboard show typography and current-user icon spacing while adding underline room", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");

    expect(dashboard).toContain('<ControllerIcon className="dashboard-show-current-user-icon" />');
    expect(css).toContain('.dashboard-show-name-content .dashboard-show-name-text{position:relative;display:inline-block;max-width:100%;padding-bottom:4px;margin-bottom:-4px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}');
    expect(css).toContain('.dashboard-show-current-user-icon{display:inline-block;width:15px;height:15px;margin-left:8px;vertical-align:-2px;text-decoration:none}');
  });
});
