import { describe, expect, it } from "vitest";
import {
  acceptedScheduleMatches,
  createAcceptedScheduleSnapshot,
  generateSchedule,
  validateSchedule,
  type ScheduleSeed,
} from "../schedule-setup";
import {
  completeWeek,
  confirmResult,
  createEmptyTrackerState,
  type TrackerState,
} from "../tracker-state";
import { detectActiveWeek } from "../week-progression";
import { LEAGUE_NAMES, type LeagueName } from "../types";

const userLeague: LeagueName = "National League";
const seeds = Object.fromEntries(
  LEAGUE_NAMES.map((league, leagueIndex) => [
    league,
    Array.from({ length: 12 }, (_, index) => ({
      seed: index + 1,
      wrestler: `QA L${leagueIndex + 1} Wrestler ${index + 1}`,
    })),
  ]),
) as Record<LeagueName, ScheduleSeed[]>;
const rosters = Object.fromEntries(
  LEAGUE_NAMES.map((league) => [league, seeds[league].map((row) => row.wrestler)]),
) as Record<LeagueName, string[]>;

describe("QA full split progression", () => {
  it("confirms and locks all 22 Closing Split weeks without duplicate results or a hard-stuck", () => {
    const preview = generateSchedule({
      leagueYear: 2,
      split: "Closing Split",
      yearWeekStart: 25,
      generatedAt: "2026-07-04T00:00:00.000Z",
      seeds,
    });
    const validation = validateSchedule(preview, { rosters });
    const acceptedSchedule = createAcceptedScheduleSnapshot({
      preview,
      validation,
      leagueYear: 2,
      split: "Closing Split",
      acceptedAt: "2026-07-04T00:00:00.000Z",
    });
    const matches = acceptedScheduleMatches(acceptedSchedule);
    let state: TrackerState = {
      ...createEmptyTrackerState(),
      acceptedSchedule,
      activeWorkflow: {
        leagueYear: 2,
        split: "Closing Split",
        yearWeek: 25,
        splitWeek: 1,
        scheduleSource: "accepted generated snapshot",
        acceptedScheduleAt: acceptedSchedule.acceptedAt,
        activatedAt: "2026-07-04T00:00:00.000Z",
        userLeague,
      },
    };

    for (let yearWeek = 25; yearWeek <= 46; yearWeek += 1) {
      const weekMatches = matches.filter((match) => match.week === yearWeek);
      expect(weekMatches).toHaveLength(24);

      for (const match of weekMatches) {
        const confirmation = confirmResult(
          state,
          {
            league: match.league,
            week: match.week,
            matchId: match.id,
            wrestlerA: match.wrestlerA,
            wrestlerB: match.wrestlerB,
            resultType: "Winner",
            winner: match.wrestlerA,
            source: match.league === userLeague ? "Manual" : "Simulation",
            confirmedAt: `2026-07-${String(yearWeek - 24).padStart(2, "0")}T00:00:00.000Z`,
          },
          matches,
          userLeague,
        );
        expect(confirmation.ok).toBe(true);
        state = confirmation.state;
      }

      const lock = completeWeek(
        state,
        yearWeek,
        matches,
        userLeague,
        `2026-08-${String(yearWeek - 24).padStart(2, "0")}T00:00:00.000Z`,
      );
      expect(lock.ok).toBe(true);
      state = lock.state;
      expect(state.completedWeeks).toHaveLength(yearWeek - 24);
    }

    expect(state.confirmedResults).toHaveLength(528);
    expect(new Set(state.confirmedResults.map((result) => result.matchId)).size).toBe(528);
    expect(state.activeWorkflow).toMatchObject({ yearWeek: 47, splitWeek: 23 });
    expect(detectActiveWeek(state, matches, 24)).toMatchObject({
      activeWeek: null,
      latestLockedWeek: 46,
      seasonComplete: true,
    });
  });
});
