import type { Match, MatchResult } from "./types";
import type { ConfirmedResult } from "./tracker-state";

export type HistoricalResultType = "win" | "draw" | "loss";

export interface HistoricalMatchResult {
  matchId: string;
  league: Match["league"];
  split: Match["split"];
  leagueYear: number;
  week: number;
  wrestlerA: string;
  wrestlerB: string;
  resultType: "Winner" | "Draw" | "No Contest";
  winner: string | null;
}

export function buildHistoricalResults(matches: Match[], masterResults: MatchResult[], localResults: ConfirmedResult[]): HistoricalMatchResult[] {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const seen = new Set<string>();
  const history: HistoricalMatchResult[] = [];
  for (const result of masterResults) {
    const match = byId.get(result.matchId);
    if (!match || result.outcome === "unclear") continue;
    seen.add(result.matchId);
    history.push({
      matchId: result.matchId,
      league: match.league,
      split: match.split,
      leagueYear: match.leagueYear,
      week: match.week,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      resultType: result.outcome === "decisive" ? "Winner" : result.outcome === "draw" ? "Draw" : "No Contest",
      winner: result.outcome === "decisive" ? result.winner : null,
    });
  }
  for (const result of localResults) {
    if (seen.has(result.matchId)) continue;
    const match = byId.get(result.matchId);
    history.push({
      matchId: result.matchId,
      league: result.league,
      split: match?.split ?? "Closing Split",
      leagueYear: match?.leagueYear ?? 2,
      week: result.week,
      wrestlerA: result.wrestlerA,
      wrestlerB: result.wrestlerB,
      resultType: result.resultType,
      winner: result.winner,
    });
  }
  return history.sort((a, b) => a.leagueYear - b.leagueYear || a.week - b.week || a.matchId.localeCompare(b.matchId));
}
