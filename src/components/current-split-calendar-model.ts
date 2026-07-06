import type { CompletedWeek, ConfirmedResult, ConfirmedResultType } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type RoundType, type SplitName } from "@/domain/types";

export type CalendarResultOrigin = "manual" | "simulation" | "confirmed";
export type CalendarWeekState = "completed" | "confirmed" | "partial";

export interface CurrentSplitCalendarMatch {
  matchId: string;
  league: LeagueName;
  leagueYear: number;
  split: SplitName;
  yearWeek: number;
  splitWeek: number;
  roundType: RoundType;
  matchNumber: number;
  wrestlerA: string;
  wrestlerB: string;
  resultType: ConfirmedResultType;
  winner: string | null;
  resultLabel: string;
  origin: CalendarResultOrigin;
  sourceLabel: string;
  isUserLeague: boolean;
  isWeekCompleted: boolean;
}

export interface CurrentSplitCalendarWeek {
  yearWeek: number;
  splitWeek: number;
  roundType: RoundType;
  state: CalendarWeekState;
  confirmedCount: number;
  scheduledCount: number;
  matches: CurrentSplitCalendarMatch[];
}

export interface CurrentSplitCalendarView {
  leagueYear: number;
  split: SplitName;
  userLeague: LeagueName;
  weeks: CurrentSplitCalendarWeek[];
  wrestlerNames: string[];
  confirmedResultCount: number;
}

interface BuildCurrentSplitCalendarInput {
  matches: Match[];
  workbookResults: MatchResult[];
  localResults: ConfirmedResult[];
  completedWeeks: CompletedWeek[];
  workbookCompletedThroughWeek: number;
  leagueYear: number;
  split: SplitName;
  userLeague: LeagueName;
}

function splitWeek(split: SplitName, yearWeek: number): number {
  return split === "Closing Split" ? yearWeek - 24 : yearWeek;
}

function originFor(source: MatchResult["resultSource"] | ConfirmedResult["source"]): CalendarResultOrigin {
  if (source === "Simulation") return "simulation";
  if (source === "Manual" || source === "User") return "manual";
  return "confirmed";
}

function sourceLabel(origin: CalendarResultOrigin): string {
  if (origin === "manual") return "Manual result";
  if (origin === "simulation") return "Simulated result";
  return "Confirmed result";
}

function resultLabel(resultType: ConfirmedResultType, winner: string | null): string {
  if (resultType === "Winner") return winner ? `${winner} won` : "Winner unavailable";
  return resultType === "Draw" ? "Draw" : "No contest";
}

function workbookResultType(result: MatchResult): ConfirmedResultType | null {
  if (result.outcome === "decisive") return result.winner ? "Winner" : null;
  if (result.outcome === "draw") return "Draw";
  if (result.outcome === "no-contest") return "No Contest";
  return null;
}

function sameMatchIdentity(result: ConfirmedResult, match: Match): boolean {
  return result.league === match.league
    && result.week === match.week
    && result.wrestlerA === match.wrestlerA
    && result.wrestlerB === match.wrestlerB
    && (result.resultType !== "Winner" || result.winner === match.wrestlerA || result.winner === match.wrestlerB)
    && (result.resultType === "Winner" || result.winner === null);
}

function leagueOrder(league: LeagueName, userLeague: LeagueName): number {
  return league === userLeague ? -1 : LEAGUE_NAMES.indexOf(league);
}

export function buildCurrentSplitCalendar(input: BuildCurrentSplitCalendarInput): CurrentSplitCalendarView {
  const scopedMatches = input.matches.filter((match) => (
    match.leagueYear === input.leagueYear && match.split === input.split
  ));
  const matchById = new Map(scopedMatches.map((match) => [match.id, match]));
  const completedWeeks = new Set(input.completedWeeks.map((entry) => entry.week));
  const resultsByMatch = new Map<string, {
    resultType: ConfirmedResultType;
    winner: string | null;
    origin: CalendarResultOrigin;
  }>();

  for (const result of input.workbookResults) {
    const match = matchById.get(result.matchId);
    const resultType = workbookResultType(result);
    if (!match || !resultType) continue;
    if (resultType === "Winner" && result.winner !== match.wrestlerA && result.winner !== match.wrestlerB) continue;
    resultsByMatch.set(match.id, {
      resultType,
      winner: resultType === "Winner" ? result.winner : null,
      origin: originFor(result.resultSource),
    });
  }

  for (const result of input.localResults) {
    const match = matchById.get(result.matchId);
    if (!match || !sameMatchIdentity(result, match)) continue;
    resultsByMatch.set(match.id, {
      resultType: result.resultType,
      winner: result.winner,
      origin: originFor(result.source),
    });
  }

  const calendarMatches = scopedMatches.flatMap((match): CurrentSplitCalendarMatch[] => {
    const result = resultsByMatch.get(match.id);
    if (!result) return [];
    const weekCompleted = completedWeeks.has(match.week) || match.week <= input.workbookCompletedThroughWeek;
    return [{
      matchId: match.id,
      league: match.league,
      leagueYear: match.leagueYear,
      split: match.split,
      yearWeek: match.week,
      splitWeek: splitWeek(match.split, match.week),
      roundType: match.roundType,
      matchNumber: match.matchNumber,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      resultType: result.resultType,
      winner: result.winner,
      resultLabel: resultLabel(result.resultType, result.winner),
      origin: result.origin,
      sourceLabel: sourceLabel(result.origin),
      isUserLeague: match.league === input.userLeague,
      isWeekCompleted: weekCompleted,
    }];
  }).sort((a, b) => (
    a.yearWeek - b.yearWeek
    || leagueOrder(a.league, input.userLeague) - leagueOrder(b.league, input.userLeague)
    || a.matchNumber - b.matchNumber
    || a.matchId.localeCompare(b.matchId)
  ));

  const availableWeeks = [...new Set(calendarMatches.map((match) => match.yearWeek))];
  const weeks = availableWeeks.map((yearWeek): CurrentSplitCalendarWeek => {
    const matches = calendarMatches.filter((match) => match.yearWeek === yearWeek);
    const scheduledCount = scopedMatches.filter((match) => match.week === yearWeek).length;
    const fullyConfirmed = scheduledCount > 0 && matches.length === scheduledCount;
    const completed = fullyConfirmed && (
      completedWeeks.has(yearWeek) || yearWeek <= input.workbookCompletedThroughWeek
    );
    return {
      yearWeek,
      splitWeek: splitWeek(input.split, yearWeek),
      roundType: matches[0]?.roundType ?? scopedMatches.find((match) => match.week === yearWeek)?.roundType ?? "Hinrunde",
      state: completed ? "completed" : fullyConfirmed ? "confirmed" : "partial",
      confirmedCount: matches.length,
      scheduledCount,
      matches,
    };
  });

  const wrestlerNames = [...new Set(calendarMatches.flatMap((match) => [match.wrestlerA, match.wrestlerB]))]
    .sort((a, b) => a.localeCompare(b));

  return {
    leagueYear: input.leagueYear,
    split: input.split,
    userLeague: input.userLeague,
    weeks,
    wrestlerNames,
    confirmedResultCount: calendarMatches.length,
  };
}
