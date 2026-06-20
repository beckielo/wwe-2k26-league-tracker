import { LEAGUE_NAMES, type LeagueName, type Match, type StandingRow } from "./types";
import type { TrackerState } from "./tracker-state";
import type { GeneratedScheduleMatch } from "./schedule-setup";

export type RosterReplacementWindowType = "After Hinrunde" | "Post-finals";

export interface RosterReplacementLogEntry {
  id: string;
  timestamp: string;
  windowType: RosterReplacementWindowType;
  oldWrestler: string;
  newWrestler: string;
  league: LeagueName;
  leagueYear: number;
  split: string;
  week: number;
  note: "new wrestler starts from 0";
}

export interface RosterReplacementWindowStatus {
  unlocked: boolean;
  windowType: RosterReplacementWindowType | null;
  reason: string;
}

export interface ReplaceWrestlerInput {
  state: TrackerState;
  activeRoster: StandingRow[];
  matches: Match[];
  league: LeagueName;
  oldWrestler: string;
  newWrestler: string;
  leagueYear: number;
  split: string;
  week: number;
  now?: string;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const displayName = (value: string) => value.trim().replace(/\s+/g, " ");

export function isRosterReplacementWindow(state: TrackerState): RosterReplacementWindowStatus {
  const activeWeek = state.activeWorkflow?.yearWeek;
  const lockedWeeks = new Set(state.completedWeeks.map((entry) => entry.week));
  const hasWeek12Started = state.confirmedResults.some((result) => result.week === 12) || lockedWeeks.has(12);
  if (!state.activeWorkflow && lockedWeeks.has(11) && !hasWeek12Started) {
    return { unlocked: true, windowType: "After Hinrunde", reason: "Roster replacement is open after Week 11 and before Week 12 starts." };
  }
  const finalsComplete = new Set((state.completedFinalsNights ?? []).map((entry) => entry.night)).size >= 2
    && (state.leagueFinalsResults ?? []).length > 0;
  if (finalsComplete && !state.activeWorkflow) {
    return { unlocked: true, windowType: "Post-finals", reason: "Roster replacement is open after League Finals and before the next split starts." };
  }
  if (activeWeek) return { unlocked: false, windowType: null, reason: "Roster replacement is locked during active weekly play." };
  return { unlocked: false, windowType: null, reason: "Roster replacement unlocks after the first round or after League Finals." };
}

export function applyRosterReplacementsToStandings(rows: StandingRow[], replacements: RosterReplacementLogEntry[] = []): StandingRow[] {
  return replacements.reduce((current, replacement) => current.map((row) => {
    if (row.league !== replacement.league || normalize(row.wrestler) !== normalize(replacement.oldWrestler)) return row;
    return { ...row, wrestler: replacement.newWrestler, matches: 0, wins: 0, draws: 0, losses: 0, points: 0, status: "manual draft replacement" };
  }), rows);
}

export function applyRosterReplacementsToMatches<T extends Match | GeneratedScheduleMatch>(matches: T[], replacements: RosterReplacementLogEntry[], completedMatchIds: Set<string> = new Set()): T[] {
  return matches.map((match) => {
    if (completedMatchIds.has(match.id)) return match;
    let next = match;
    for (const replacement of replacements) {
      const matchWeek = "week" in next ? next.week : next.yearWeek;
      if (next.league !== replacement.league || (matchWeek ?? 0) <= replacement.week) continue;
      const wrestlerA = normalize(next.wrestlerA) === normalize(replacement.oldWrestler) ? replacement.newWrestler : next.wrestlerA;
      const wrestlerB = normalize(next.wrestlerB) === normalize(replacement.oldWrestler) ? replacement.newWrestler : next.wrestlerB;
      if (wrestlerA !== next.wrestlerA || wrestlerB !== next.wrestlerB) next = { ...next, wrestlerA, wrestlerB };
    }
    return next;
  });
}

export function replaceWrestler(input: ReplaceWrestlerInput): { ok: boolean; state: TrackerState; errors: string[]; logEntry?: RosterReplacementLogEntry } {
  const window = isRosterReplacementWindow(input.state);
  if (!window.unlocked || !window.windowType) return { ok: false, state: input.state, errors: [window.reason] };
  const newName = displayName(input.newWrestler);
  if (!newName) return { ok: false, state: input.state, errors: ["New wrestler name is required."] };
  if (!LEAGUE_NAMES.includes(input.league)) return { ok: false, state: input.state, errors: ["Selected league is invalid."] };
  const activeRoster = applyRosterReplacementsToStandings(input.activeRoster, input.state.rosterReplacements ?? []);
  const activeNames = activeRoster.map((row) => normalize(row.wrestler));
  if (activeNames.includes(normalize(newName))) return { ok: false, state: input.state, errors: [`${newName} already exists in the active roster.`] };
  const leagueRows = activeRoster.filter((row) => row.league === input.league);
  if (leagueRows.length !== 12) return { ok: false, state: input.state, errors: [`${input.league} must have exactly 12 active wrestlers before replacement.`] };
  const old = leagueRows.find((row) => normalize(row.wrestler) === normalize(input.oldWrestler));
  if (!old) return { ok: false, state: input.state, errors: [`${input.oldWrestler} is not active in ${input.league}.`] };
  const logEntry: RosterReplacementLogEntry = {
    id: `replacement-${Date.now()}-${normalize(old.wrestler).replace(/[^a-z0-9]+/g, "-")}`,
    timestamp: input.now ?? new Date().toISOString(),
    windowType: window.windowType,
    oldWrestler: old.wrestler,
    newWrestler: newName,
    league: input.league,
    leagueYear: input.leagueYear,
    split: input.split,
    week: input.week,
    note: "new wrestler starts from 0",
  };
  const completedIds = new Set(input.state.confirmedResults.map((result) => result.matchId));
  const acceptedSchedule = input.state.acceptedSchedule ? { ...input.state.acceptedSchedule, matches: applyRosterReplacementsToMatches(input.state.acceptedSchedule.matches, [logEntry], completedIds) } : input.state.acceptedSchedule;
  const nextRoster = applyRosterReplacementsToStandings(activeRoster, [logEntry]);
  if (nextRoster.length !== 48 || nextRoster.filter((row) => row.league === input.league).length !== 12 || new Set(nextRoster.map((row) => normalize(row.wrestler))).size !== 48) {
    return { ok: false, state: input.state, errors: ["Replacement would make the active roster invalid."] };
  }
  return { ok: true, errors: [], logEntry, state: { ...input.state, acceptedSchedule, rosterReplacements: [...(input.state.rosterReplacements ?? []), logEntry], currentUserWrestler: normalize(input.state.currentUserWrestler ?? "") === normalize(old.wrestler) ? newName : input.state.currentUserWrestler } };
}
