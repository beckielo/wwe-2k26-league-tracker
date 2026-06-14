import type { LegacyFact, PostFinalsAssignment, PostFinalsTransition } from "./post-finals-transition";
import { LEAGUE_NAMES, type LeagueName, type Match, type SplitName, type StandingRow } from "./types";

export const SCHEDULE_SOURCE_MISSING_MESSAGE =
  "Schedule source missing: create/import schedule before starting the next split.";

export interface ProposedSeed {
  league: LeagueName;
  seed: number;
  wrestler: string;
  priorLeague: LeagueName;
  priorRank: number;
  movement: PostFinalsAssignment["movement"];
  orderingReason: string;
}

export interface SeedContinuityResult {
  seeds: Record<LeagueName, ProposedSeed[]>;
  valid: boolean;
  errors: string[];
  orderingExplanation: string;
}

export interface ScheduleReadiness {
  ready: boolean;
  sourcePresent: boolean;
  errors: string[];
  message: string;
}

export interface HistoryFact extends LegacyFact {
  leagueYear: number;
  split: SplitName;
}

export type NextContinuityAction =
  | "Complete League Finals first"
  | "Complete Post-Finals Transition first"
  | "Import/create schedule"
  | "Start next split/year";

export interface YearRolloverContinuity {
  currentLeagueYear: number;
  currentSplit: SplitName;
  nextLeagueYear: number;
  nextSplit: SplitName;
  openingSplitComplete: boolean;
  closingSplitComplete: boolean;
  leagueFinalsComplete: boolean;
  postFinalsTransitionValid: boolean;
  setupAllowed: boolean;
  scheduleReadiness: ScheduleReadiness;
  seedContinuity: SeedContinuityResult;
  proposedLeagueComposition: Record<LeagueName, PostFinalsAssignment[]>;
  historyFacts: HistoryFact[];
  legacyFormulaMessage: "Legacy formula Review Required — facts preserved only.";
  nextAction: NextContinuityAction;
  week25WorkflowAllowed: boolean;
  year3WorkflowAllowed: boolean;
}

interface YearRolloverInput {
  leagueYear: number;
  split: SplitName;
  completedThroughWeek: number;
  previousFinalStandings: StandingRow[];
  transition: PostFinalsTransition;
  nextSchedule: Match[];
}

const tier = new Map<LeagueName, number>(LEAGUE_NAMES.map((league, index) => [league, index]));

function finalsHeadToHeadOrder(a: PostFinalsAssignment, b: PostFinalsAssignment): number {
  if (a.finalsOutcome === `Defeated ${b.wrestler}`) return -1;
  if (b.finalsOutcome === `Defeated ${a.wrestler}`) return 1;
  return 0;
}

export function assignContinuitySeeds(
  previousFinalStandings: StandingRow[],
  composition: Record<LeagueName, PostFinalsAssignment[]>,
): SeedContinuityResult {
  const errors: string[] = [];
  const finalRows = new Map(previousFinalStandings.map((row) => [row.wrestler, row]));
  const allAssignments = LEAGUE_NAMES.flatMap((league) => composition[league]);
  const names = allAssignments.map((row) => row.wrestler);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];

  if (duplicates.length) errors.push(`Duplicate wrestlers in proposed seeds: ${duplicates.join(", ")}.`);
  for (const row of previousFinalStandings) {
    if (!names.includes(row.wrestler)) errors.push(`${row.wrestler} is missing from proposed seeds.`);
  }
  for (const assignment of allAssignments) {
    if (!finalRows.has(assignment.wrestler)) {
      errors.push(`${assignment.wrestler} has no previous completed split standing.`);
    }
  }
  if (names.length !== previousFinalStandings.length) {
    errors.push(`Proposed seeds contain ${names.length} wrestlers for ${previousFinalStandings.length} final standing rows.`);
  }

  const seeds = Object.fromEntries(LEAGUE_NAMES.map((league) => {
    const ordered = [...composition[league]].sort((a, b) =>
      (tier.get(a.priorLeague) ?? 99) - (tier.get(b.priorLeague) ?? 99)
      || a.priorRank - b.priorRank
      || finalsHeadToHeadOrder(a, b)
      || a.wrestler.localeCompare(b.wrestler),
    );
    if (ordered.length !== 12) errors.push(`${league} has ${ordered.length} proposed seeds; expected exactly 12.`);
    const proposed = ordered.map<ProposedSeed>((assignment, index) => ({
      league,
      seed: index + 1,
      wrestler: assignment.wrestler,
      priorLeague: assignment.priorLeague,
      priorRank: assignment.priorRank,
      movement: assignment.movement,
      orderingReason: "Previous league tier, previous final rank, relevant League Finals head-to-head, then alphabetical fallback.",
    }));
    const seedNumbers = proposed.map((row) => row.seed);
    if (new Set(seedNumbers).size !== 12 || Math.min(...seedNumbers) !== 1 || Math.max(...seedNumbers) !== 12) {
      errors.push(`${league} must contain seeds 1–12 exactly once.`);
    }
    return [league, proposed];
  })) as Record<LeagueName, ProposedSeed[]>;

  return {
    seeds,
    valid: errors.length === 0,
    errors,
    orderingExplanation:
      "Seeds are assigned after league membership is resolved, using previous league tier, final rank, and a directly relevant League Finals head-to-head result. Alphabetical order is the deterministic final fallback for seed/order generation only. Seed and alphabetical order never resolve standings or competition outcomes.",
  };
}

export function validateNextSplitSchedule(
  schedule: Match[],
  composition: Record<LeagueName, PostFinalsAssignment[]>,
): ScheduleReadiness {
  if (schedule.length === 0) {
    return { ready: false, sourcePresent: false, errors: [], message: SCHEDULE_SOURCE_MISSING_MESSAGE };
  }

  const errors: string[] = [];
  for (const league of LEAGUE_NAMES) {
    const roster = new Set(composition[league].map((row) => row.wrestler));
    const leagueMatches = schedule.filter((match) => match.league === league);
    const weeks = new Set(leagueMatches.map((match) => match.week));
    if (weeks.size !== 22) errors.push(`${league} schedule has ${weeks.size} regular weeks; expected 22.`);
    if (leagueMatches.length !== 132) errors.push(`${league} schedule has ${leagueMatches.length} matches; expected 132.`);

    const pairingCounts = new Map<string, number>();
    for (const match of leagueMatches) {
      if (!roster.has(match.wrestlerA) || !roster.has(match.wrestlerB)) {
        errors.push(`${league} Week ${match.week} contains a wrestler outside the proposed league composition.`);
      }
      if (match.wrestlerA === match.wrestlerB) errors.push(`${match.wrestlerA} is scheduled against themselves.`);
      const pair = [match.wrestlerA, match.wrestlerB].sort().join("::");
      pairingCounts.set(pair, (pairingCounts.get(pair) ?? 0) + 1);
    }
    for (const week of weeks) {
      const weekMatches = leagueMatches.filter((match) => match.week === week);
      if (weekMatches.length !== 6) errors.push(`${league} Week ${week} has ${weekMatches.length} matches; expected 6.`);
      const appearances = weekMatches.flatMap((match) => [match.wrestlerA, match.wrestlerB]);
      if (new Set(appearances).size !== 12 || appearances.length !== 12) {
        errors.push(`${league} Week ${week} must contain every wrestler exactly once.`);
      }
    }
    const expectedPairs = 66;
    if (pairingCounts.size !== expectedPairs) errors.push(`${league} has ${pairingCounts.size} unique matchups; expected ${expectedPairs}.`);
    for (const [pair, count] of pairingCounts) {
      if (count !== 2) errors.push(`${league} matchup ${pair.replace("::", " vs ")} occurs ${count} times; expected twice.`);
    }
  }

  return {
    ready: errors.length === 0,
    sourcePresent: true,
    errors: [...new Set(errors)],
    message: errors.length === 0 ? "Authoritative 22-week double round robin schedule is valid." : "Schedule source is present but invalid.",
  };
}

export function deriveYearRolloverContinuity(input: YearRolloverInput): YearRolloverContinuity {
  const openingSplitComplete = input.split === "Closing Split"
    || (input.split === "Opening Split" && input.completedThroughWeek >= 22 && input.transition.finalsComplete);
  const closingSplitComplete = input.split === "Closing Split"
    && input.completedThroughWeek >= 48
    && input.transition.finalsComplete;
  const postFinalsTransitionValid = input.transition.unlocked && input.transition.compositionValid;
  const seedContinuity = assignContinuitySeeds(input.previousFinalStandings, input.transition.leagueComposition);
  const scheduleReadiness = validateNextSplitSchedule(input.nextSchedule, input.transition.leagueComposition);
  const setupAllowed = input.transition.finalsComplete
    && postFinalsTransitionValid
    && seedContinuity.valid
    && scheduleReadiness.ready;
  const nextSplit = input.split === "Opening Split" ? "Closing Split" : "Opening Split";
  const nextLeagueYear = input.split === "Closing Split" ? input.leagueYear + 1 : input.leagueYear;
  const nextAction: NextContinuityAction = !input.transition.finalsComplete
    ? "Complete League Finals first"
    : !postFinalsTransitionValid
      ? "Complete Post-Finals Transition first"
      : !scheduleReadiness.ready
        ? "Import/create schedule"
        : "Start next split/year";

  return {
    currentLeagueYear: input.leagueYear,
    currentSplit: input.split,
    nextLeagueYear,
    nextSplit,
    openingSplitComplete,
    closingSplitComplete,
    leagueFinalsComplete: input.transition.finalsComplete,
    postFinalsTransitionValid,
    setupAllowed,
    scheduleReadiness,
    seedContinuity,
    proposedLeagueComposition: input.transition.leagueComposition,
    historyFacts: input.transition.legacyFacts.map((fact) => ({
      ...fact,
      leagueYear: input.leagueYear,
      split: input.split,
    })),
    legacyFormulaMessage: "Legacy formula Review Required — facts preserved only.",
    nextAction,
    week25WorkflowAllowed: input.split === "Opening Split" && setupAllowed,
    year3WorkflowAllowed: input.split === "Closing Split" && setupAllowed,
  };
}
