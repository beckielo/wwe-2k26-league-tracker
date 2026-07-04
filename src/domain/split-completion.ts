import {
  calculateWinningStreaks,
  decideMultiWrestlerTiebreak,
  decideTwoWrestlerTiebreak,
  detectPointTies,
} from "./tiebreakers";
import type {
  LeagueName,
  Match,
  MatchResult,
  MatchupReferenceRow,
  SplitName,
  StandingRow,
  StreakRecord,
} from "./types";

export type SplitNextPhase =
  | "Regular Week"
  | "Tiebreaker Review"
  | "League Finals Preparation"
  | "No Authoritative Next Phase";

export type TieReviewStatus =
  | "Resolved by Head-to-Head"
  | "Resolved by Winning Streak"
  | "Tiebreaker Match Required"
  | "Review Required";

export interface ConsequentialTieReview {
  league: LeagueName;
  points: number;
  placements: number[];
  wrestlers: string[];
  status: TieReviewStatus;
  winner: string | null;
  recommendedFormat: string | null;
  explanation: string;
}

export interface SplitCompletionReview {
  leagueYear: number;
  split: SplitName;
  completedRegularSplitWeek: number;
  regularPhaseComplete: boolean;
  nextPhase: SplitNextPhase;
  nextRegularWeek: number | null;
  finalRegularStandings: StandingRow[];
  consequentialTies: ConsequentialTieReview[];
  hasAuthoritativeWeek23Schedule: boolean;
  hasAuthoritativeWeek24Template: boolean;
  sourceWarnings: string[];
}

interface SplitCompletionInput {
  leagueYear: number;
  split: SplitName;
  completedThroughWeek: number;
  standings: StandingRow[];
  matches: Match[];
  results: MatchResult[];
  matchupReference: MatchupReferenceRow[];
  hasLeagueFinalsTemplate: boolean;
}

function streakRecords(matches: Match[], results: MatchResult[]): StreakRecord[] {
  return calculateWinningStreaks(matches, results).map((record) => ({
    league: record.league,
    wrestler: record.wrestler,
    seed: 0,
    currentStreak: record.currentWinningStreak,
    longestWinningStreak: record.longestWinningStreak,
    lastResult: "",
    notes: null,
  }));
}

function headToHeadRecords(matches: Match[], results: MatchResult[]) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  return results.flatMap((result) => {
    const match = matchById.get(result.matchId);
    if (!match || result.outcome !== "decisive" || !result.winner || !result.loser) return [];
    return [{
      league: match.league,
      week: match.week,
      roundType: match.roundType,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      winner: result.winner,
      loser: result.loser,
    }];
  });
}

export function deriveSplitCompletionReview(input: SplitCompletionInput): SplitCompletionReview {
  const completedRegularSplitWeek = Math.min(input.completedThroughWeek, 22);
  const regularPhaseComplete = input.completedThroughWeek >= 22;
  const matchSplitWeek = (match: Match) => input.split === "Closing Split" ? match.week - 24 : match.week;
  const splitMatches = input.matches.filter((match) =>
    match.leagueYear === input.leagueYear
    && match.split === input.split
    && matchSplitWeek(match) <= 22,
  );
  const splitMatchIds = new Set(splitMatches.map((match) => match.id));
  const splitResults = input.results.filter((result) => splitMatchIds.has(result.matchId));
  const week23Matches = input.matches.some((match) =>
    match.leagueYear === input.leagueYear
    && match.split === input.split
    && matchSplitWeek(match) === 23
    && match.roundType === "Tiebreaker",
  );
  const week23Reference = input.matchupReference.some((row) =>
    row.week === 23 && row.roundType === "Tiebreaker",
  );
  const hasAuthoritativeWeek23Schedule = week23Matches || week23Reference;

  let nextPhase: SplitNextPhase;
  let nextRegularWeek: number | null = null;
  if (input.completedThroughWeek < 22) {
    nextPhase = "Regular Week";
    nextRegularWeek = input.completedThroughWeek + 1;
  } else if (input.completedThroughWeek === 22) {
    nextPhase = "Tiebreaker Review";
  } else if (input.completedThroughWeek === 23) {
    nextPhase = "League Finals Preparation";
  } else {
    nextPhase = "No Authoritative Next Phase";
  }

  const sourceWarnings: string[] = [];
  if (regularPhaseComplete && !hasAuthoritativeWeek23Schedule) {
    sourceWarnings.push(
      "No authoritative Week 23 tiebreaker schedule or matchup template is present. Review ties; do not generate fixtures.",
    );
  }
  if (input.completedThroughWeek >= 23 && !input.hasLeagueFinalsTemplate) {
    sourceWarnings.push(
      "No authoritative Week 24 League Finals template is present. Do not generate a finals card.",
    );
  }
  if (input.completedThroughWeek >= 24) {
    sourceWarnings.push(input.split === "Opening Split"
      ? "The Opening Split ends at Week 24. Week 25 belongs to the Closing Split and is not invented here."
      : "The Closing Split is complete through its Finals week. The next League Year is not invented here.");
  }

  const standings = [...input.standings].sort(
    (a, b) => a.league.localeCompare(b.league) || a.rank - b.rank,
  );
  const streaks = streakRecords(splitMatches, splitResults);
  const headToHead = headToHeadRecords(splitMatches, splitResults);
  const consequentialTies = regularPhaseComplete
    ? detectPointTies(standings)
      .filter((tie) => tie.relevant)
      .map((tie): ConsequentialTieReview => {
        const placements = tie.wrestlers.map((row) => row.rank);
        const wrestlers = tie.wrestlers.map((row) => row.wrestler);
        if (tie.wrestlers.length >= 3) {
          const decision = decideMultiWrestlerTiebreak(tie.wrestlers, headToHead, streaks);
          return {
            league: tie.league,
            points: tie.points,
            placements,
            wrestlers,
            status: decision.status,
            winner: decision.winner,
            recommendedFormat: decision.recommendedFormat,
            explanation: `${tie.explanation} ${decision.explanation}`,
          };
        }

        const decision = decideTwoWrestlerTiebreak(
          tie.wrestlers[0],
          tie.wrestlers[1],
          headToHead,
          streaks,
        );
        const status: TieReviewStatus = decision.criterion === "head-to-head"
          ? "Resolved by Head-to-Head"
          : decision.criterion === "longest-winning-streak"
            ? "Resolved by Winning Streak"
            : decision.matchRequired
              ? "Tiebreaker Match Required"
              : "Review Required";
        return {
          league: tie.league,
          points: tie.points,
          placements,
          wrestlers,
          status,
          winner: decision.winner,
          recommendedFormat: null,
          explanation: `${tie.explanation} ${decision.explanation}`,
        };
      })
    : [];

  return {
    leagueYear: input.leagueYear,
    split: input.split,
    completedRegularSplitWeek,
    regularPhaseComplete,
    nextPhase,
    nextRegularWeek,
    finalRegularStandings: standings,
    consequentialTies,
    hasAuthoritativeWeek23Schedule,
    hasAuthoritativeWeek24Template: input.hasLeagueFinalsTemplate,
    sourceWarnings,
  };
}
