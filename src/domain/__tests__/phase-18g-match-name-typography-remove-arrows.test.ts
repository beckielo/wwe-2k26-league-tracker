import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 18G dashboard match typography and action arrow cleanup", () => {
  it("applies readable League Control typography to current user show wrestler name text", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");

    expect(dashboard).toContain('<span className="dashboard-show-name-text">{children}</span>');
    expect(dashboard).toContain('<ControllerIcon className="dashboard-show-current-user-icon" />');
    expect(css).toContain(".dashboard-show-wrestler-name{font-size:16px;line-height:1.08;font-weight:950;letter-spacing:.015em;text-transform:uppercase}");
    expect(css).toContain(".dashboard-show-name-content .dashboard-show-name-text{color:inherit;font-family:var(--font-geist-sans),Arial,sans-serif;font-size:16px;font-weight:950;line-height:1.08;letter-spacing:.015em;text-transform:uppercase}");
    expect(css).toContain(".h2h-last-winner{text-decoration:underline");
    expect(css).toContain(".dashboard-show-current-user-icon");
  });

  it("removes action arrows while preserving dashboard action links and routes", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const ui = source("src/components/ui.tsx");
    const results = source("src/components/result-entry-workflow.tsx");
    const workflowBanner = source("src/components/workflow-summary-banner.tsx");
    const weekReview = source("src/components/week-review.tsx");

    expect(dashboard).toContain('<Link href={nextHref} className="action-button action-primary">{nextLabel}</Link>');
    expect(dashboard).toContain('<Link href="/schedule">Full schedule</Link>');
    expect(dashboard).toContain('<strong>Open Legacy Table</strong>');
    expect(dashboard).not.toContain('<b aria-hidden>→</b>');
    expect(ui).toContain('{action}</ActionButton>');
    expect(results).toContain('{summary.recommendedLabel}');
    expect(workflowBanner).toContain('{summary.recommendedLabel}');
    expect(weekReview).toContain('Full Live Standings</Link>');
    expect(`${dashboard}\n${ui}\n${results}\n${workflowBanner}\n${weekReview}`).not.toContain('<span aria-hidden>→</span>');
    expect(results).not.toContain('{summary.recommendedLabel} →');
    expect(workflowBanner).not.toContain('{summary.recommendedLabel} →');
  });
});
