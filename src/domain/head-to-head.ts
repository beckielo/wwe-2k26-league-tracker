import type { HistoricalMatchResult } from "./match-history";
import type { Match } from "./types";

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

export interface PreviousHeadToHeadInput {
  wrestlerA: string;
  wrestlerB: string;
  leagueYear: number;
  split: Match["split"];
  week: number;
  matchNumber?: number;
  currentMatchId?: string;
  results: HistoricalMatchResult[];
}

function samePair(match: HistoricalMatchResult, left: string, right: string) {
  return (match.wrestlerA === left && match.wrestlerB === right) || (match.wrestlerA === right && match.wrestlerB === left);
}

function isBeforeCurrent(match: HistoricalMatchResult, input: PreviousHeadToHeadInput) {
  if (match.matchId === input.currentMatchId) return false;
  if (match.leagueYear !== input.leagueYear || match.split !== input.split) return false;
  if (match.week < input.week) return true;
  if (match.week > input.week) return false;
  if (input.matchNumber === undefined || match.matchNumber === undefined) return false;
  return match.matchNumber < input.matchNumber;
}

function byCompletedOrder(a: HistoricalMatchResult, b: HistoricalMatchResult) {
  return a.leagueYear - b.leagueYear || a.week - b.week || (a.matchNumber ?? 0) - (b.matchNumber ?? 0) || a.matchId.localeCompare(b.matchId);
}

export function derivePreviousH2HWinner(input: PreviousHeadToHeadInput): string | null {
  const last = input.results
    .filter((match) => samePair(match, input.wrestlerA, input.wrestlerB) && isBeforeCurrent(match, input))
    .sort(byCompletedOrder)
    .at(-1);

  if (!last || last.resultType !== "Winner") return null;
  return last.winner === input.wrestlerA || last.winner === input.wrestlerB ? last.winner : null;
}

export function getPreviousHeadToHeadWinner(input: PreviousHeadToHeadInput): string | null {
  return derivePreviousH2HWinner(input);
}

export function getPreviousHeadToHeadContext(input: PreviousHeadToHeadInput): HeadToHeadContext {
  const meetings = input.results
    .filter((match) => samePair(match, input.wrestlerA, input.wrestlerB) && isBeforeCurrent(match, input))
    .sort(byCompletedOrder);
  const last = meetings.at(-1);
  if (!last) return { found: false, matchId: null, league: null, split: null, year: null, week: null, winner: null, resultType: null, shouldUnderlineLeft: false, shouldUnderlineRight: false, dataQualityWarnings: [`No prior H2H found for ${input.wrestlerA} vs ${input.wrestlerB}.`] };
  const winner = derivePreviousH2HWinner(input);
  return {
    found: true,
    matchId: last.matchId,
    league: last.league,
    split: last.split,
    year: last.leagueYear,
    week: last.week,
    winner,
    resultType: last.resultType,
    shouldUnderlineLeft: winner === input.wrestlerA,
    shouldUnderlineRight: winner === input.wrestlerB,
    dataQualityWarnings: last.resultType === "Winner" && !winner ? [`Ambiguous H2H winner for ${last.matchId}.`] : [],
  };
}

export function getLastHeadToHead(left: string, right: string, history: HistoricalMatchResult[], currentMatchId?: string): HeadToHeadContext {
  const meetings = history.filter((match) => match.matchId !== currentMatchId && samePair(match, left, right)).sort(byCompletedOrder);
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
