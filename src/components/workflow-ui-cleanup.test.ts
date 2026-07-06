import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("workflow UI cleanup wiring", () => {
  it("moves Legacy Table and Create New Run into quick navigation while preserving the existing run flow", () => {
    const shell = source("src/components/app-shell.tsx");
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const newRunPage = source("src/app/new-run/page.tsx");

    expect(shell).toContain('["Legacy Table", "/legacy", "history"]');
    expect(shell).toContain('["Create New Run", "/new-run", "shield"]');
    expect(shell).not.toContain('["Replace Wrestler"');
    expect(dashboard).not.toContain("Open Legacy Table");
    expect(dashboard).not.toContain("<NewRunSetupWizard");
    expect(dashboard).toContain("const SHOW_REPLACE_WRESTLER_ON_DASHBOARD = false");
    expect(dashboard).toContain("<ReplaceWrestlerControl");
    expect(existsSync("src/components/replace-wrestler-control.tsx")).toBe(true);
    expect(newRunPage).toContain("<NewRunSetupWizard");
  });

  it("uses one visual Result Entry matchup selector and removes the Weekly Workflow panel", () => {
    const form = source("src/components/result-entry-form.tsx");
    const workflow = source("src/components/result-entry-workflow.tsx");

    expect(form).toContain('role="listbox" aria-label="Scheduled matchups"');
    expect(form).toContain('role="option"');
    expect(form).toContain("aria-selected={selectedMatch}");
    expect(form).not.toContain('<select\n      id="match"');
    expect(workflow).not.toContain("Weekly workflow");
    expect(workflow).not.toContain("What happens next");
  });

  it("reuses the Full Schedule preview structure and league artwork on Calendar", () => {
    const calendar = source("src/components/current-split-calendar.tsx");

    expect(calendar).toContain("CalendarResultPreview");
    expect(calendar).toContain("week-match-preview calendar-result-preview");
    expect(calendar).toContain('className="match-preview-backdrop"');
    expect(calendar).toContain('className="match-preview-versus"');
    expect(calendar).toContain("Confirmed result preview");
  });

  it("removes the six Simulation summary cards without changing preview, confirm, or undo controls", () => {
    const workflow = source("src/components/simulation-workflow.tsx");
    const workbench = source("src/components/simulation-workbench.tsx");

    expect(workflow).not.toContain('label="Active simulation week"');
    expect(workflow).not.toContain('label="Open simulation matches"');
    expect(workflow).not.toContain('label="Excluded user league"');
    expect(workflow).not.toContain("Simulation league");
    expect(workbench).toContain("Generate preview");
    expect(workbench).toContain("Confirm results");
    expect(workbench).toContain("Undo confirmed simulation");
    expect(workbench).toContain("weekLocked");
  });

  it("keeps Week Review controls functional while flattening backup and promotion presentation", () => {
    const review = source("src/components/week-review.tsx");

    expect(review).not.toContain("Current week");
    expect(review).toContain('className="week-review-close-card');
    expect(review).toContain('aria-label="Backup and data export"');
    expect(review).not.toContain("Advanced backup and data export");
    expect(review).toContain("<PromoteCurrentMaster");
    expect(review).toContain("compact");
    expect(review.indexOf("<MiniLiveStandingsPreview")).toBeLessThan(review.indexOf('aria-label="Backup and data export"'));
    expect(review.indexOf('aria-label="Backup and data export"')).toBeLessThan(review.indexOf("<PromoteCurrentMaster"));
  });
});
