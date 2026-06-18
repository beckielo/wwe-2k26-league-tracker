import type { HistoricalMatchResult } from "./match-history";

export interface HeadToHeadContext {
  found: boolean;
  matchId: string | null;
  league: string | null;
  split: string | null;
  year: number | null;
  week: number | null;
  winner: string | null;
  resultType: "Winner" | "Draw" | "No Contest" | null;
  shouldUnderlineLeft: boolean;
  shouldUnderlineRight: boolean;
  dataQualityWarnings: string[];
}

function samePair(match: HistoricalMatchResult, left: string, right: string) {
  return (match.wrestlerA === left && match.wrestlerB === right) || (match.wrestlerA === right && match.wrestlerB === left);
}

export function getLastHeadToHead(left: string, right: string, history: HistoricalMatchResult[], currentMatchId?: string): HeadToHeadContext {
  const meetings = history.filter((match) => match.matchId !== currentMatchId && samePair(match, left, right));
  const last = meetings.at(-1);
  if (!last) return { found: false, matchId: null, league: null, split: null, year: null, week: null, winner: null, resultType: null, shouldUnderlineLeft: false, shouldUnderlineRight: false, dataQualityWarnings: [`No prior H2H found for ${left} vs ${right}.`] };
  const decisive = last.resultType === "Winner" && !!last.winner;
  return {
    found: true,
    matchId: last.matchId,
    league: last.league,
    split: last.split,
    year: last.leagueYear,
    week: last.week,
    winner: decisive ? last.winner : null,
    resultType: last.resultType,
    shouldUnderlineLeft: decisive && last.winner === left,
    shouldUnderlineRight: decisive && last.winner === right,
    dataQualityWarnings: last.resultType === "Winner" && !last.winner ? [`Ambiguous H2H winner for ${last.matchId}.`] : [],
  };
}
