export const LEAGUE_NAMES = [
  "Global League",
  "Continental League",
  "National League",
  "Regional League",
] as const;

export type LeagueName = (typeof LEAGUE_NAMES)[number];
export type SplitName = "Opening Split" | "Closing Split";
export type RoundType = "Hinrunde" | "Rückrunde" | "Tiebreaker" | "League Finals";
export type MatchStatus = "completed" | "scheduled";
export type ResultSource = "User" | "Manual" | "Simulation" | "Unknown";

export interface SourceRef {
  file: string;
  sheet: string;
  row?: number;
}

export interface Wrestler {
  id: string;
  name: string;
}

export interface League {
  id: string;
  name: LeagueName;
  showDay: "Montag" | "Dienstag" | "Mittwoch" | "Freitag";
  wrestlers: LeagueMembership[];
}

export interface LeagueMembership {
  wrestler: Wrestler;
  seed: number;
  startStatus: string | null;
}

export interface Split {
  name: SplitName;
  yearWeekStart: number;
  yearWeekEnd: number;
  regularWeeks: number;
  tiebreakerWeek: number;
  finalsWeek: number;
}

export interface Week {
  leagueYear: number;
  yearWeek: number;
  split: SplitName;
  splitWeek: number;
  roundType: RoundType;
  purpose: string;
}

export interface Match {
  id: string;
  leagueYear: number;
  split: SplitName;
  week: number;
  roundType: RoundType;
  league: LeagueName;
  showDay: League["showDay"];
  matchNumber: number;
  wrestlerA: string;
  wrestlerB: string;
  matchupKey: string;
  status: MatchStatus;
  source: SourceRef;
}

export interface MatchResult {
  matchId: string;
  outcome: "decisive" | "draw" | "no-contest" | "unclear";
  winner: string | null;
  loser: string | null;
  resultSource: ResultSource;
  notes: string | null;
  source: SourceRef;
}

export interface StandingRow {
  league: LeagueName;
  rank: number;
  wrestler: string;
  seed: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  status: string;
}

export interface HeadToHeadRecord {
  league: LeagueName;
  week: number;
  roundType: RoundType;
  wrestlerA: string;
  wrestlerB: string;
  winner: string;
  loser: string;
}

export interface StreakRecord {
  league: LeagueName;
  wrestler: string;
  seed: number;
  currentStreak: number;
  longestWinningStreak: number;
  lastResult: "W" | "L" | "D" | "";
  notes: string | null;
}

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  source?: SourceRef;
}

export interface TrackerMeta {
  leagueYear: number;
  leagueYearLabel: string;
  currentSplit: SplitName;
  currentWeek: number;
  latestAppWritebackWeek: number | null;
  latestAppWritebackCompletedAt: string | null;
  appBaselineCompletedThroughWeek: number;
  usesAppWritebackSheets: boolean;
  currentStatus: string;
  userLeague: LeagueName;
  userWrestler: string;
  nextUserShow: string;
}

export interface MatchupReferenceRow {
  week: number;
  roundType: RoundType;
  league: LeagueName;
  showDay: League["showDay"];
  matchNumber: number;
  wrestlerA: string;
  wrestlerB: string;
  matchupKey: string;
  sourceLabel: string;
  status: string;
}

export interface TrackerData {
  sourceFile: string;
  meta: TrackerMeta;
  splits: Split[];
  weeks: Week[];
  leagues: League[];
  matches: Match[];
  results: MatchResult[];
  appWritebackResults: import("./tracker-state").ConfirmedResult[];
  standings: StandingRow[];
  headToHead: HeadToHeadRecord[];
  streaks: StreakRecord[];
  matchupReference: MatchupReferenceRow[];
  validationIssues: ValidationIssue[];
}
