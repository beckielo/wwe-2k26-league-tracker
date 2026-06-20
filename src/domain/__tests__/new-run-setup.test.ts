import { describe, expect, it } from "vitest";
import { activateFreshRunSetup, addCawToDraft, createEmptyNewRunSetupDraft, validateFreshRunState, validateNewRunSetupDraft } from "../new-run-setup";
import { acceptedScheduleMatches } from "../schedule-setup";
import { createEmptyTrackerState } from "../tracker-state";
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

  it("marks valid manual drafts ready for Phase 14B activation", () => {
    const validation = validateNewRunSetupDraft(filledDraft());
    expect(validation.valid).toBe(true);
    expect(validation.readyForActivation).toBe(true);
  });
});


describe("Phase 14B fresh run activation", () => {
  it("invalid setup cannot activate and does not mutate old active state", () => {
    const old = { ...createEmptyTrackerState(), confirmedResults: [{ league: "Global League" as const, week: 1, matchId: "old", wrestlerA: "A", wrestlerB: "B", resultType: "Winner" as const, winner: "A", source: "Manual" as const, confirmedAt: "now" }] };
    const result = activateFreshRunSetup(old, createEmptyNewRunSetupDraft(), "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(old);
    expect(result.state.confirmedResults).toHaveLength(1);
  });

  it("valid manual 48-wrestler setup activates League Year 1 Opening Split Week 1", () => {
    const draft = filledDraft();
    draft.caws = ["Wrestler 7"];
    const result = activateFreshRunSetup({ ...createEmptyTrackerState(), completedWeeks: [{ week: 10, completedAt: "old" }] }, draft, "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.state.activeWorkflow).toMatchObject({ leagueYear: 1, split: "Opening Split", yearWeek: 1, splitWeek: 1 });
    expect(result.state.confirmedResults).toEqual([]);
    expect(result.state.completedWeeks).toEqual([]);
    expect(result.state.leagueFinalsResults).toEqual([]);
    expect(result.state.acceptedSchedule?.validation.valid).toBe(true);
    expect(result.state.acceptedSchedule?.matches).toHaveLength(528);
    expect(result.state.currentUserWrestler).toBe("Wrestler 7");
    const weekOne = acceptedScheduleMatches(result.state.acceptedSchedule!).filter((match) => match.week === 1);
    expect(weekOne).toHaveLength(24);
  });

  it("activation creates 4 leagues with 12 zeroed standings and preserves seeds", () => {
    const draft = filledDraft();
    draft.manualRoster["Global League"][0] = "  Beckielo  ";
    const result = activateFreshRunSetup(createEmptyTrackerState(), draft, "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.state.currentUserWrestler).toBe("Beckielo");
    const standings = LEAGUE_NAMES.flatMap((league) => draft.manualRoster[league].map((name, index) => ({ league, rank: index + 1, wrestler: name.trim().replace(/\s+/g, " "), seed: index + 1, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "fresh run seed" })));
    expect(validateFreshRunState(result.state, standings)).toEqual([]);
    for (const league of LEAGUE_NAMES) expect(standings.filter((row) => row.league === league)).toHaveLength(12);
    expect(standings.every((row) => row.matches === 0 && row.wins === 0 && row.draws === 0 && row.losses === 0 && row.points === 0)).toBe(true);
  });

  it("activation rejects duplicate names", () => {
    const draft = filledDraft();
    draft.manualRoster["National League"][0] = "Wrestler 1";
    const result = activateFreshRunSetup(createEmptyTrackerState(), draft);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Duplicate active wrestlers");
  });

  it("automatic mode cannot activate while generator is unavailable", () => {
    const draft = createEmptyNewRunSetupDraft();
    draft.rosterMode = "automatic";
    const result = activateFreshRunSetup(createEmptyTrackerState(), draft);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Automatic roster generation");
  });
});
