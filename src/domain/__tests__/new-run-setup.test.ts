import { describe, expect, it } from "vitest";
import { addCawToDraft, createEmptyNewRunSetupDraft, validateNewRunSetupDraft } from "../new-run-setup";
import { LEAGUE_NAMES } from "../types";

function filledDraft() {
  const draft = createEmptyNewRunSetupDraft();
  draft.rosterMode = "manual";
  let index = 1;
  for (const league of LEAGUE_NAMES) {
    draft.manualRoster[league] = Array.from({ length: 12 }, () => `Wrestler ${index++}`);
  }
  return draft;
}

describe("Phase 14A new run setup validation", () => {
  it("records backup choice separately from active state data", () => {
    const draft = { ...createEmptyNewRunSetupDraft(), backupChoice: "skipped" as const };
    expect(draft.backupChoice).toBe("skipped");
    expect(draft.manualRoster["Global League"]).toHaveLength(12);
  });

  it("rejects duplicate CAWs case-insensitively after trimming", () => {
    const draft = createEmptyNewRunSetupDraft();
    const first = addCawToDraft(draft, "  Star Alpha  ");
    expect(first.errors).toEqual([]);
    const second = addCawToDraft(first.draft, "star alpha");
    expect(second.errors).toContain("star alpha is already in the CAW list.");
  });

  it("requires 48 filled unique manual wrestlers", () => {
    const draft = createEmptyNewRunSetupDraft();
    draft.rosterMode = "manual";
    const validation = validateNewRunSetupDraft(draft);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Manual active roster must contain exactly 48 filled wrestlers; found 0.");
  });

  it("rejects duplicate active wrestlers case-insensitively", () => {
    const draft = filledDraft();
    draft.manualRoster["Regional League"][11] = " wrestler 1 ";
    const validation = validateNewRunSetupDraft(draft);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Duplicate active wrestlers are not allowed: wrestler 1.");
  });

  it("keeps Phase 14A drafts preview-only and not ready for activation", () => {
    const validation = validateNewRunSetupDraft(filledDraft());
    expect(validation.valid).toBe(true);
    expect(validation.readyForActivation).toBe(false);
  });
});
