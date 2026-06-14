import { describe, expect, it } from "vitest";
import { LEAGUE_NAMES, type LeagueName } from "../types";
import { canActivateNextWeek, createAcceptedScheduleSnapshot, generateSchedule, getScheduleAcceptanceStatus, importScheduleJson, validateSchedule, type ScheduleSeed } from "../schedule-setup";

const seeds = Object.fromEntries(LEAGUE_NAMES.map((league, leagueIndex) => [league, Array.from({ length: 12 }, (_, i) => ({ seed: i + 1, wrestler: `L${leagueIndex + 1} Wrestler ${i + 1}` }))])) as Record<LeagueName, ScheduleSeed[]>;
const rosters = Object.fromEntries(LEAGUE_NAMES.map((league) => [league, seeds[league].map((row) => row.wrestler)])) as Record<LeagueName, string[]>;
const build = () => generateSchedule({ leagueYear: 2, split: "Closing Split", yearWeekStart: 25, generatedAt: "2026-06-14T00:00:00.000Z", seeds });

describe("Phase 9.6 schedule setup", () => {
  it("generates the complete deterministic double round robin", () => {
    const schedule = build();
    expect(schedule).toHaveLength(528);
    expect(new Set(schedule.map((row) => row.id)).size).toBe(528);
    expect(validateSchedule(schedule, { rosters }).valid).toBe(true);
    for (const league of LEAGUE_NAMES) {
      const rows = schedule.filter((row) => row.league === league);
      expect(rows).toHaveLength(132);
      expect(new Set(rows.map((row) => row.splitWeek)).size).toBe(22);
      for (let week = 1; week <= 22; week += 1) {
        const weekRows = rows.filter((row) => row.splitWeek === week);
        expect(weekRows).toHaveLength(6);
        expect(new Set(weekRows.flatMap((row) => [row.wrestlerA, row.wrestlerB])).size).toBe(12);
        expect(weekRows.every((row) => row.wrestlerA !== row.wrestlerB)).toBe(true);
      }
      for (const wrestler of rosters[league]) expect(rows.filter((row) => row.wrestlerA === wrestler || row.wrestlerB === wrestler)).toHaveLength(22);
      for (let week = 1; week <= 11; week += 1) {
        const first = rows.filter((row) => row.splitWeek === week);
        const second = rows.filter((row) => row.splitWeek === week + 11);
        expect(second.map((row) => `${row.wrestlerB}::${row.wrestlerA}`)).toEqual(first.map((row) => `${row.wrestlerA}::${row.wrestlerB}`));
      }
    }
    expect(build()).toEqual(schedule);
  });

  it("maps the same seed-slot template to every league and changes with seed order", () => {
    const original = build();
    const firstPairs = LEAGUE_NAMES.map((league) => original.find((row) => row.league === league && row.splitWeek === 1)?.["seedA"] + ":" + original.find((row) => row.league === league && row.splitWeek === 1)?.["seedB"]);
    expect(new Set(firstPairs).size).toBe(1);
    const changedSeeds = { ...seeds, "Global League": [...seeds["Global League"]].reverse().map((row, i) => ({ ...row, seed: i + 1 })) };
    const changed = generateSchedule({ leagueYear: 2, split: "Closing Split", generatedAt: "2026-06-14T00:00:00.000Z", seeds: changedSeeds });
    expect(validateSchedule(changed, { rosters }).valid).toBe(true);
    expect(changed.map((row) => [row.wrestlerA, row.wrestlerB])).not.toEqual(original.map((row) => [row.wrestlerA, row.wrestlerB]));
  });

  it("rejects structural errors, locked overlap, unknown names, duplicate appearances, missing pairs, and duplicate IDs", () => {
    const base = build();
    expect(validateSchedule(base, { rosters, lockedYearWeeks: [25] }).valid).toBe(false);
    const cases = [
      base.map((row, i) => i === 0 ? { ...row, wrestlerA: "Unknown" } : row),
      base.map((row, i) => i === 1 ? { ...row, wrestlerA: base[0].wrestlerA } : row),
      base.slice(1),
      base.map((row, i) => i === 1 ? { ...row, id: base[0].id } : row),
    ];
    for (const invalid of cases) expect(validateSchedule(invalid, { rosters }).valid).toBe(false);
  });

  it("imports valid JSON with normalized names and rejects invalid imports", () => {
    const base = build();
    const normalized = base.map((row) => ({ ...row, league: row.league.toUpperCase(), wrestlerA: row.wrestlerA.toUpperCase() }));
    expect(importScheduleJson(JSON.stringify(normalized), { rosters }).validation.valid).toBe(true);
    expect(importScheduleJson("not-json", { rosters }).validation.valid).toBe(false);
    expect(importScheduleJson(JSON.stringify(base.map((row, i) => i === 0 ? { ...row, wrestlerA: "Mystery" } : row)), { rosters }).validation.valid).toBe(false);
  });

  it("blocks activation until transition, seeds, and accepted schedule are valid", () => {
    const validation = validateSchedule(build(), { rosters });
    const accepted = { matches: build(), acceptedAt: "now", acceptedBy: "local user workflow" as const, source: "Generated" as const, leagueYear: 2, split: "Closing Split" as const, seedSource: "Phase 9.5", rosterSource: "Phase 9B", validation };
    expect(canActivateNextWeek({ transitionValid: true, seedsValid: true, target: "Closing Split Week 1" })).toBe(false);
    expect(canActivateNextWeek({ transitionValid: false, seedsValid: true, acceptedSchedule: accepted, target: "Closing Split Week 1" })).toBe(false);
    expect(canActivateNextWeek({ transitionValid: true, seedsValid: true, acceptedSchedule: accepted, target: "Closing Split Week 1" })).toBe(true);
    expect(canActivateNextWeek({ transitionValid: true, seedsValid: true, acceptedSchedule: accepted, target: "New League Year Week 1" })).toBe(false);
  });

  it("uses explicit, complete acceptance gating for generated and imported previews", () => {
    const preview = build();
    const validation = validateSchedule(preview, { rosters });
    const ready = {
      transitionReady: true,
      seedsReady: true,
      preview,
      validation,
      hasBlockingManualReview: false,
      hasAcceptedSnapshot: false,
      replaceConfirmed: false,
    };

    expect(getScheduleAcceptanceStatus({ ...ready, preview: [], validation: validateSchedule([], { rosters }) })).toEqual({
      enabled: false,
      disabledReason: "Generate or import a valid schedule preview first.",
    });
    expect(getScheduleAcceptanceStatus({ ...ready, preview: preview.slice(1), validation: validateSchedule(preview.slice(1), { rosters }) }).disabledReason).toBe("Validation must be valid before acceptance.");
    expect(getScheduleAcceptanceStatus(ready)).toEqual({ enabled: true, disabledReason: null });

    const imported = importScheduleJson(JSON.stringify(preview), { rosters });
    expect(getScheduleAcceptanceStatus({ ...ready, preview: imported.matches, validation: imported.validation }).enabled).toBe(true);
    expect(getScheduleAcceptanceStatus({ ...ready, hasBlockingManualReview: true }).disabledReason).toBe("Resolve blocking Manual Review items first.");
    expect(getScheduleAcceptanceStatus({ ...ready, hasAcceptedSnapshot: true }).disabledReason).toBe("Existing accepted snapshot present — check replace box to overwrite.");
    expect(getScheduleAcceptanceStatus({ ...ready, hasAcceptedSnapshot: true, replaceConfirmed: true }).enabled).toBe(true);
  });

  it("creates accepted snapshot metadata without mutating the preview", () => {
    const preview = build();
    const original = structuredClone(preview);
    const validation = validateSchedule(preview, { rosters });
    const accepted = createAcceptedScheduleSnapshot({
      preview,
      validation,
      acceptedAt: "2026-06-14T12:00:00.000Z",
      leagueYear: 2,
      split: "Closing Split",
    });

    expect(preview).toEqual(original);
    expect(accepted).toMatchObject({
      acceptedAt: "2026-06-14T12:00:00.000Z",
      leagueYear: 2,
      split: "Closing Split",
      source: "Generated",
      generatorVersion: "1.0.0",
      validation: { valid: true, status: "Valid", totalMatches: 528 },
    });
    expect(accepted.matches).toHaveLength(528);
    expect(accepted.matches.every((match) => match.validationStatus === "Valid")).toBe(true);
    expect(canActivateNextWeek({ transitionValid: true, seedsValid: true, acceptedSchedule: accepted, target: "Closing Split Week 1" })).toBe(true);
  });
});
