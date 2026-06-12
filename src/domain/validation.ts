import { calculatePoints } from "./scoring";
import { calculateStandings } from "./standings";
import type {
  League,
  Match,
  MatchResult,
  StandingRow,
  TrackerData,
  ValidationIssue,
} from "./types";

export interface ResultEntryInput {
  matchId: string;
  winner: string;
}

export function validateLeagueRosters(leagues: League[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allNames = new Map<string, string>();

  for (const league of leagues) {
    if (league.wrestlers.length !== 12) {
      issues.push({
        code: "ROSTER_COUNT_INVALID",
        severity: "error",
        message: `${league.name} has ${league.wrestlers.length} wrestlers; expected 12.`,
      });
    }
    const local = new Set<string>();
    for (const membership of league.wrestlers) {
      const normalized = membership.wrestler.name.trim().toLocaleLowerCase();
      if (local.has(normalized)) {
        issues.push({
          code: "DUPLICATE_WRESTLER_IN_LEAGUE",
          severity: "error",
          message: `${membership.wrestler.name} appears more than once in ${league.name}.`,
        });
      }
      if (allNames.has(normalized) && allNames.get(normalized) !== league.name) {
        issues.push({
          code: "DUPLICATE_ACTIVE_WRESTLER",
          severity: "error",
          message: `${membership.wrestler.name} appears in multiple active leagues.`,
        });
      }
      local.add(normalized);
      allNames.set(normalized, league.name);
    }
  }
  return issues;
}

export function validateSchedule(matches: Match[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = `${match.leagueYear}:${match.split}:${match.week}:${match.league}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
    if (match.wrestlerA === match.wrestlerB) {
      issues.push({
        code: "SELF_MATCH",
        severity: "error",
        message: `${match.wrestlerA} is scheduled against themselves in ${match.league} Week ${match.week}.`,
        source: match.source,
      });
    }
  }

  for (const [key, weekMatches] of groups) {
    if (weekMatches.length !== 6) {
      issues.push({
        code: "MATCH_COUNT_INVALID",
        severity: "error",
        message: `${key} has ${weekMatches.length} matches; expected 6.`,
      });
    }
    const appearances = new Map<string, number>();
    for (const match of weekMatches) {
      appearances.set(match.wrestlerA, (appearances.get(match.wrestlerA) ?? 0) + 1);
      appearances.set(match.wrestlerB, (appearances.get(match.wrestlerB) ?? 0) + 1);
    }
    for (const [wrestler, count] of appearances) {
      if (count > 1) {
        issues.push({
          code: "DUPLICATE_WEEK_APPEARANCE",
          severity: "error",
          message: `${wrestler} appears ${count} times in ${key}.`,
        });
      }
    }
  }
  return issues;
}

export function validateStandingPoints(standings: StandingRow[]): ValidationIssue[] {
  return standings.flatMap((row) => {
    const expected = calculatePoints(row.wins, row.draws);
    return expected === row.points
      ? []
      : [{
          code: "POINTS_MISMATCH",
          severity: "error" as const,
          message: `${row.wrestler} has ${row.points} points; expected ${expected}.`,
        }];
  });
}

export function validateStandingsAgainstResults(
  leagues: League[],
  matches: Match[],
  results: MatchResult[],
  standings: StandingRow[],
): ValidationIssue[] {
  const seeds = leagues.flatMap((league) =>
    league.wrestlers.map((membership) => ({
      league: league.name,
      wrestler: membership.wrestler.name,
      seed: membership.seed,
    })),
  );
  const calculated = calculateStandings(seeds, matches, results);
  const calculatedByKey = new Map(calculated.map((row) => [`${row.league}:${row.wrestler}`, row]));

  return standings.flatMap((sourceRow) => {
    const computed = calculatedByKey.get(`${sourceRow.league}:${sourceRow.wrestler}`);
    if (!computed) {
      return [{
        code: "STANDING_WRESTLER_MISSING",
        severity: "error" as const,
        message: `${sourceRow.wrestler} is in standings but missing from the active roster.`,
      }];
    }
    const fields = ["matches", "wins", "draws", "losses", "points"] as const;
    const mismatch = fields.find((field) => sourceRow[field] !== computed[field]);
    return mismatch
      ? [{
          code: "STANDING_RECORD_MISMATCH",
          severity: "error" as const,
          message: `${sourceRow.wrestler} ${mismatch} is ${sourceRow[mismatch]}; results calculate ${computed[mismatch]}.`,
        }]
      : [];
  });
}

export function validateResultEntry(
  input: ResultEntryInput,
  scheduledMatches: Match[],
): { valid: true; match: Match; loser: string } | { valid: false; message: string } {
  const match = scheduledMatches.find((candidate) => candidate.id === input.matchId);
  if (!match) {
    return { valid: false, message: "This matchup is not present in the authoritative schedule." };
  }
  if (match.status === "completed") {
    return { valid: false, message: "This scheduled matchup already has a result." };
  }
  if (input.winner !== match.wrestlerA && input.winner !== match.wrestlerB) {
    return { valid: false, message: "The winner must be one of the two scheduled wrestlers." };
  }
  return {
    valid: true,
    match,
    loser: input.winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA,
  };
}

export function validateTrackerData(data: Omit<TrackerData, "validationIssues">): ValidationIssue[] {
  return [
    ...validateLeagueRosters(data.leagues),
    ...validateSchedule(data.matches),
    ...validateStandingPoints(data.standings),
    ...validateStandingsAgainstResults(data.leagues, data.matches, data.results, data.standings),
  ];
}
