import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("normal user-facing copy", () => {
  it("removes workbook, App-sheet and baseline copy from the primary workflow surfaces", () => {
    const primaryUi = [
      source("src/app/page.tsx"),
      source("src/components/workflow-summary-banner.tsx"),
      source("src/components/result-entry-workflow.tsx"),
      source("src/components/week-review.tsx"),
    ].join("\n");

    expect(primaryUi).not.toMatch(/Workbook connected|Workbook completed through|App workbook baseline|App_\* sheets|Active browser-local workflow|Excel remains read-only/);
    expect(primaryUi).toContain("Progress saved through");
    expect(primaryUi).toContain("Confirmed results and week locks are saved on this device");
  });

  it("does not expose raw analytics sheet names on H2H, Streaks or Legacy pages", () => {
    const analyticsUi = [
      source("src/app/head-to-head/page.tsx"),
      source("src/app/streaks/page.tsx"),
      source("src/app/legacy/page.tsx"),
      source("src/components/legacy-page-client.tsx"),
    ].join("\n");

    expect(analyticsUi).not.toMatch(/H2H_Tracker|Winning_Streaks|Legacy_Tracker|current-context reconstruction|Workbook-backed career archive/);
    expect(analyticsUi).toContain("All-time honours remain preserved");
  });

  it("keeps technical saved-data details collapsed and signatures out of the prominent warning", () => {
    const shell = source("src/components/app-shell.tsx");

    expect(shell).toContain("<details>");
    expect(shell).toContain("Review technical details");
    expect(shell).toContain("Some saved data does not match the current week");
    expect(shell).not.toContain("Confidence: {authority.confidence}");
    expect(shell).not.toContain("{authority.sourceSignature}</small>");
  });
});
