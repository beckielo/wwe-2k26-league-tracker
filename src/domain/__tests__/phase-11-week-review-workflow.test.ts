import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 11 Week Review workflow overhaul", () => {
  const weekReview = source("src/components/week-review.tsx");
  const promote = source("src/components/promote-current-master.tsx");

  it("keeps the linear workflow order: locked confirmation, Close Week, Promote Current Master", () => {
    expect(weekReview.indexOf("is complete and locked")).toBeLessThan(weekReview.indexOf("Close Week {week}"));
    expect(weekReview.indexOf("Close Week {week}")).toBeLessThan(weekReview.indexOf("<PromoteCurrentMaster"));
  });

  it("hides close package, safe workbook update, and detailed result boxes from the default page", () => {
    expect(weekReview).not.toContain("<WeekReviewExports");
    expect(weekReview).not.toContain("<SafeWorkbookUpdate");
    expect(weekReview).not.toContain("Missing results");
    expect(weekReview).not.toContain("Confirmed results");
    expect(weekReview).not.toContain('label="Missing"');
    expect(weekReview).not.toContain('label="Confirmed"');
  });

  it("keeps validation and promotion internals while using the Live Standings source for the mini preview", () => {
    expect(weekReview).toContain("progress.validationErrors");
    expect(weekReview).toContain("Complete & lock Week {week}");
    expect(weekReview).toContain("reconstructActiveSplitLiveStandings");
    expect(weekReview).toContain("MiniLiveStandingsPreview");
    expect(weekReview).toContain("Full Live Standings");
  });

  it("shows the GitHub continuation prompt and navigates to Dashboard on success", () => {
    expect(promote).toContain("Do you want");
    expect(promote.indexOf("Do you want")).toBeLessThan(promote.indexOf("props.promptPreview"));
    expect(promote).toContain('router.push("/")');
    expect(promote).toContain("/api/finalize-current-master");
    expect(promote).toContain("No, stay here");
  });
});
