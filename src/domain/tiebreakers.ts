import type {
  HeadToHeadRecord,
  LeagueName,
  Match,
  MatchResult,
  StandingRow,
  StreakRecord,
} from "./types";

export interface HeadToHeadSummary {
  wrestlerA: string;
  wrestlerB: string;
  meetings: number;
  winsA: number;
  winsB: number;
  draws: number;
  isTied: boolean;
  isOneToOne: boolean;
  leader: string | null;
}

export interface CalculatedStreak {
  league: LeagueName;
  wrestler: string;
  currentWinningStreak: number;
  longestWinningStreak: number;
}

export type CompetitiveZone =
  | "champion-direct-promotion"
  | "champion-elite-cup"
  | "elite-cup"
  | "promotion-playoff"
  | "safe"
  | "relegation-playoff"
  | "direct-relegation";

export interface TieGroup {
  league: LeagueName;
  points: number;
  wrestlers: StandingRow[];
  zones: CompetitiveZone[];
  relevant: boolean;
  explanation: string;
}

export type TiebreakCriterion = "points" | "head-to-head" | "longest-winning-streak" | "tiebreaker-match";

export interface TiebreakDecision {
  wrestlerA: string;
  wrestlerB: string;
  winner: string | null;
  criterion: TiebreakCriterion;
  matchRequired: boolean;
  explanation: string;
  headToHead: HeadToHeadSummary;
  longestStreakA: number;
  longestStreakB: number;
}

export type MultiWrestlerTiebreakStatus =
  | "Resolved by Winning Streak"
  | "Resolved by Head-to-Head"
  | "Tiebreaker Match Required"
  | "Review Required";

export type MultiWrestlerTiebreakFormat =
  | "Triple Threat Tiebreaker"
  | "Mini-Tournament"
  | "Fatal 5-Way Tiebreaker"
  | "Review Required";

export interface MultiWrestlerTiebreakDecision {
  status: MultiWrestlerTiebreakStatus;
  orderedWrestlers: string[];
  winner: string | null;
  recommendedFormat: MultiWrestlerTiebreakFormat | null;
  explanation: string;
}

export function calculateHeadToHead(
  wrestlerA: string,
  wrestlerB: string,
  records: HeadToHeadRecord[],
): HeadToHeadSummary {
  const meetings = records.filter((record) =>
    (record.wrestlerA === wrestlerA && record.wrestlerB === wrestlerB)
    || (record.wrestlerA === wrestlerB && record.wrestlerB === wrestlerA),
  );
  const winsA = meetings.filter((record) => record.winner === wrestlerA).length;
  const winsB = meetings.filter((record) => record.winner === wrestlerB).length;
  const draws = meetings.length - winsA - winsB;
  return {
    wrestlerA,
    wrestlerB,
    meetings: meetings.length,
    winsA,
    winsB,
    draws,
    isTied: winsA === winsB,
    isOneToOne: meetings.length === 2 && winsA === 1 && winsB === 1,
    leader: winsA === winsB ? null : winsA > winsB ? wrestlerA : wrestlerB,
  };
}

export function calculateWinningStreaks(
  matches: Match[],
  results: MatchResult[],
): CalculatedStreak[] {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const orderedResults = results
    .map((result) => ({ result, match: matchById.get(result.matchId) }))
    .filter((entry): entry is { result: MatchResult; match: Match } => Boolean(entry.match))
    .sort((a, b) =>
      a.match.league.localeCompare(b.match.league)
      || a.match.week - b.match.week
      || a.match.matchNumber - b.match.matchNumber,
    );
  const streaks = new Map<string, CalculatedStreak>();

  function row(league: LeagueName, wrestler: string): CalculatedStreak {
    const key = `${league}:${wrestler}`;
    const existing = streaks.get(key);
    if (existing) return existing;
    const created = { league, wrestler, currentWinningStreak: 0, longestWinningStreak: 0 };
    streaks.set(key, created);
    return created;
  }

  for (const { result, match } of orderedResults) {
    const wrestlerA = row(match.league, match.wrestlerA);
    const wrestlerB = row(match.league, match.wrestlerB);
    if (result.outcome === "no-contest" || result.outcome === "unclear") continue;
    if (result.outcome === "draw" || !result.winner) {
      wrestlerA.currentWinningStreak = 0;
      wrestlerB.currentWinningStreak = 0;
      continue;
    }
    const winner = result.winner === match.wrestlerA ? wrestlerA : wrestlerB;
    const loser = result.winner === match.wrestlerA ? wrestlerB : wrestlerA;
    winner.currentWinningStreak += 1;
    winner.longestWinningStreak = Math.max(winner.longestWinningStreak, winner.currentWinningStreak);
    loser.currentWinningStreak = 0;
  }

  return [...streaks.values()];
}

export function getCompetitiveZone(league: LeagueName, rank: number): CompetitiveZone {
  if (league === "Global League") {
    if (rank === 1) return "champion-elite-cup";
    if (rank <= 4) return "elite-cup";
  } else {
    if (rank === 1) return "champion-direct-promotion";
    if (rank <= 4) return "promotion-playoff";
  }
  if (rank <= 8 || league === "Regional League") return "safe";
  if (rank <= 11) return "relegation-playoff";
  return "direct-relegation";
}

const ZONE_LABELS: Record<CompetitiveZone, string> = {
  "champion-direct-promotion": "champion and direct promotion",
  "champion-elite-cup": "Global champion and Elite Cup #1 seed",
  "elite-cup": "Elite Cup qualification",
  "promotion-playoff": "promotion playoff qualification",
  safe: "same safe/status-neutral zone",
  "relegation-playoff": "relegation playoff",
  "direct-relegation": "direct relegation",
};

export function detectPointTies(standings: StandingRow[]): TieGroup[] {
  const groups = new Map<string, StandingRow[]>();
  for (const row of standings) {
    const key = `${row.league}:${row.points}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => a.rank - b.rank);
      const zones = [...new Set(sorted.map((row) => getCompetitiveZone(row.league, row.rank)))];
      const relevant = zones.length > 1;
      return {
        league: sorted[0].league,
        points: sorted[0].points,
        wrestlers: sorted,
        zones,
        relevant,
        explanation: relevant
          ? `Relevant: tied positions cross the ${zones.map((zone) => ZONE_LABELS[zone]).join(" / ")} boundary.`
          : `Not relevant: every tied wrestler remains in the ${ZONE_LABELS[zones[0]]} zone.`,
      };
    })
    .sort((a, b) => a.league.localeCompare(b.league) || b.points - a.points);
}

export function decideTwoWrestlerTiebreak(
  wrestlerA: StandingRow,
  wrestlerB: StandingRow,
  headToHeadRecords: HeadToHeadRecord[],
  streakRecords: StreakRecord[],
): TiebreakDecision {
  const headToHead = calculateHeadToHead(wrestlerA.wrestler, wrestlerB.wrestler, headToHeadRecords);
  const longestStreakA = streakRecords.find((record) => record.league === wrestlerA.league && record.wrestler === wrestlerA.wrestler)?.longestWinningStreak ?? 0;
  const longestStreakB = streakRecords.find((record) => record.league === wrestlerB.league && record.wrestler === wrestlerB.wrestler)?.longestWinningStreak ?? 0;

  if (wrestlerA.points !== wrestlerB.points) {
    const winner = wrestlerA.points > wrestlerB.points ? wrestlerA.wrestler : wrestlerB.wrestler;
    return { wrestlerA: wrestlerA.wrestler, wrestlerB: wrestlerB.wrestler, winner, criterion: "points", matchRequired: false, explanation: `${winner} leads on points.`, headToHead, longestStreakA, longestStreakB };
  }
  if (headToHead.leader) {
    return { wrestlerA: wrestlerA.wrestler, wrestlerB: wrestlerB.wrestler, winner: headToHead.leader, criterion: "head-to-head", matchRequired: false, explanation: `${headToHead.leader} leads the head-to-head ${Math.max(headToHead.winsA, headToHead.winsB)}–${Math.min(headToHead.winsA, headToHead.winsB)}.`, headToHead, longestStreakA, longestStreakB };
  }
  if (longestStreakA !== longestStreakB) {
    const winner = longestStreakA > longestStreakB ? wrestlerA.wrestler : wrestlerB.wrestler;
    return { wrestlerA: wrestlerA.wrestler, wrestlerB: wrestlerB.wrestler, winner, criterion: "longest-winning-streak", matchRequired: false, explanation: `${winner} has the longer winning streak (${Math.max(longestStreakA, longestStreakB)} vs ${Math.min(longestStreakA, longestStreakB)}).`, headToHead, longestStreakA, longestStreakB };
  }
  return {
    wrestlerA: wrestlerA.wrestler,
    wrestlerB: wrestlerB.wrestler,
    winner: null,
    criterion: "tiebreaker-match",
    matchRequired: true,
    explanation: "Points, head-to-head, and longest winning streak are still tied. Tiebreaker match required.",
    headToHead,
    longestStreakA,
    longestStreakB,
  };
}

function recommendedMultiWrestlerFormat(count: number): MultiWrestlerTiebreakFormat {
  if (count === 3) return "Triple Threat Tiebreaker";
  if (count === 4) return "Mini-Tournament";
  if (count === 5) return "Fatal 5-Way Tiebreaker";
  return "Review Required";
}

export function decideMultiWrestlerTiebreak(
  wrestlers: StandingRow[],
  headToHeadRecords: HeadToHeadRecord[],
  streakRecords: StreakRecord[],
): MultiWrestlerTiebreakDecision {
  const streakByWrestler = new Map(
    streakRecords
      .filter((record) => record.league === wrestlers[0]?.league)
      .map((record) => [record.wrestler, record.longestWinningStreak]),
  );
  const streakGroups = new Map<number, StandingRow[]>();

  for (const wrestler of wrestlers) {
    const streak = streakByWrestler.get(wrestler.wrestler) ?? 0;
    streakGroups.set(streak, [...(streakGroups.get(streak) ?? []), wrestler]);
  }

  const orderedGroups = [...streakGroups.entries()].sort(([streakA], [streakB]) => streakB - streakA);
  const orderedWrestlers: string[] = [];
  let usedHeadToHead = false;
  let unresolved = false;

  for (const [, group] of orderedGroups) {
    if (group.length === 1) {
      orderedWrestlers.push(group[0].wrestler);
      continue;
    }
    if (group.length === 2) {
      const headToHead = calculateHeadToHead(group[0].wrestler, group[1].wrestler, headToHeadRecords);
      if (headToHead.leader) {
        orderedWrestlers.push(
          headToHead.leader,
          headToHead.leader === group[0].wrestler ? group[1].wrestler : group[0].wrestler,
        );
        usedHeadToHead = true;
        continue;
      }
    }
    unresolved = true;
    orderedWrestlers.push(...group.map((row) => row.wrestler));
  }

  if (!unresolved) {
    return {
      status: usedHeadToHead ? "Resolved by Head-to-Head" : "Resolved by Winning Streak",
      orderedWrestlers,
      winner: orderedWrestlers[0] ?? null,
      recommendedFormat: null,
      explanation: usedHeadToHead
        ? "Longest winning streak ranked the group first; head-to-head resolved a remaining clean two-wrestler subgroup."
        : "Longest winning streak separated every tied wrestler. Seed was not used.",
    };
  }

  const recommendedFormat = recommendedMultiWrestlerFormat(wrestlers.length);
  const status = recommendedFormat === "Review Required"
    ? "Review Required"
    : "Tiebreaker Match Required";
  return {
    status,
    orderedWrestlers,
    winner: null,
    recommendedFormat,
    explanation: "Longest winning streak did not fully separate the group. Aggregate multi-wrestler head-to-head mini-table formulas are not used.",
  };
}
