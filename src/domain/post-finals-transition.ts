import {
  buildCanonicalLeagueFinalsRegistry,
  normalizeLeagueFinalsResults,
  resolveFinalsParticipants,
  validateLeagueFinalsResult,
  type DirectMovement,
  type FinalsNight,
  type LeagueFinalsMatch,
  type LeagueFinalsResult,
} from "./league-finals";
import type { ConsequentialTieReview } from "./split-completion";
import { LEAGUE_NAMES, type LeagueName, type StandingRow } from "./types";
import type { ManualReview } from "./tracker-state";

export type MovementKind =
  | "Champion/direct promotion"
  | "Direct relegation"
  | "Promoted"
  | "Relegated"
  | "Retained higher league"
  | "Retained lower league";

export interface PostFinalsAssignment {
  wrestler: string;
  priorLeague: LeagueName;
  priorRank: number;
  newLeague: LeagueName;
  movement: MovementKind;
  finalsOutcome: string | null;
}

export interface RelegationOutcome {
  matchId: string;
  higherLeague: LeagueName;
  lowerLeague: LeagueName;
  higherLeagueWrestler: string;
  lowerLeagueWrestler: string;
  winner: string | null;
  loser: string | null;
  outcome: "Higher retained" | "Lower promoted" | "No Contest retention" | "Review Required";
}

export interface LegacyFact {
  label: string;
  wrestler: string;
  detail: string;
}

export interface ProposedLeagueOrder {
  league: LeagueName;
  reviewRequired: true;
  wrestlers: PostFinalsAssignment[];
}

export interface PostFinalsTransition {
  unlocked: boolean;
  lockedMessage: string | null;
  finalsComplete: boolean;
  nightCompletion: Record<FinalsNight, boolean>;
  missingResults: string[];
  invalidResults: string[];
  champions: { league: LeagueName; wrestler: string }[];
  directMovements: DirectMovement[];
  relegationOutcomes: RelegationOutcome[];
  assignments: PostFinalsAssignment[];
  leagueComposition: Record<LeagueName, PostFinalsAssignment[]>;
  compositionValid: boolean;
  compositionErrors: string[];
  proposedOrder: ProposedLeagueOrder[];
  legacyFacts: LegacyFact[];
  warnings: string[];
  reviewRequired: string[];
  openingSplitComplete: boolean;
  closingSplitSetupReady: boolean;
  hasAuthoritativeClosingSchedule: boolean;
  closingScheduleMessage: string | null;
  week25Generated: false;
  diagnostics: {
    savedLeagueFinalsResultKeys: string[];
    canonicalAuthoritativeFinalsMatchIds: string[];
    migratedLegacyResultKeysCount: number;
    unmatchedSavedResultsCount: number;
    missingAuthoritativeFinalsCount: number;
    missingCanonicalIds: string[];
    extraUnmatchedSavedIds: string[];
  };
}

export interface PostFinalsTransitionInput {
  completedThroughWeek: number;
  standings: StandingRow[];
  consequentialTies: ConsequentialTieReview[];
  matches: LeagueFinalsMatch[];
  results: LeagueFinalsResult[];
  completedNights: { night: FinalsNight; completedAt: string }[];
  champions: { league: LeagueName; wrestler: string }[];
  directMovements: DirectMovement[];
  hasAuthoritativeClosingSchedule: boolean;
  manualReviews?: ManualReview[];
}

export function buildNextSplitStandings(assignments: PostFinalsAssignment[]): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) =>
    assignments
      .filter((assignment) => assignment.newLeague === league)
      .sort(proposedSort)
      .map((assignment, index) => ({
        league,
        rank: index + 1,
        wrestler: assignment.wrestler,
        seed: index + 1,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        status: "post-finals reset",
      })),
  );
}

const tier = new Map<LeagueName, number>(LEAGUE_NAMES.map((league, index) => [league, index]));

function defaultComposition(): Record<LeagueName, PostFinalsAssignment[]> {
  return {
    "Global League": [],
    "Continental League": [],
    "National League": [],
    "Regional League": [],
  };
}

function movementForDirect(movement: DirectMovement): MovementKind {
  return movement.reason === "Direct promotion" ? "Champion/direct promotion" : "Direct relegation";
}

function validateComposition(assignments: PostFinalsAssignment[], standings: StandingRow[]): string[] {
  const errors: string[] = [];
  const sourceNames = standings.map((row) => row.wrestler);
  const assignedNames = assignments.map((row) => row.wrestler);
  const duplicateSource = sourceNames.filter((name, index) => sourceNames.indexOf(name) !== index);
  const duplicateAssigned = assignedNames.filter((name, index) => assignedNames.indexOf(name) !== index);
  if (duplicateSource.length) errors.push(`Duplicate wrestler placement in final standings: ${[...new Set(duplicateSource)].join(", ")}.`);
  if (duplicateAssigned.length) errors.push(`Duplicate wrestler in post-finals composition: ${[...new Set(duplicateAssigned)].join(", ")}.`);
  for (const wrestler of new Set(sourceNames)) {
    if (!assignedNames.includes(wrestler)) errors.push(`${wrestler} is missing from post-finals composition.`);
  }
  for (const league of LEAGUE_NAMES) {
    const count = assignments.filter((row) => row.newLeague === league).length;
    if (count !== 12) errors.push(`${league} has ${count} wrestlers; expected exactly 12.`);
  }
  if (assignments.length !== standings.length) {
    errors.push(`Post-finals composition has ${assignments.length} assignments for ${standings.length} standing rows.`);
  }
  return errors;
}

function proposedSort(a: PostFinalsAssignment, b: PostFinalsAssignment): number {
  return (tier.get(a.priorLeague) ?? 99) - (tier.get(b.priorLeague) ?? 99)
    || a.priorRank - b.priorRank
    || (a.finalsOutcome ?? "").localeCompare(b.finalsOutcome ?? "")
    || (a.movement === "Champion/direct promotion" ? -1 : 0)
    || (b.movement === "Champion/direct promotion" ? 1 : 0)
    || a.wrestler.localeCompare(b.wrestler);
}

export function derivePostFinalsTransition(input: PostFinalsTransitionInput): PostFinalsTransition {
  const nightCompletion = {
    "Night One": input.completedNights.some((entry) => entry.night === "Night One"),
    "Night Two": input.completedNights.some((entry) => entry.night === "Night Two"),
  };
  const sharedRegistry = buildCanonicalLeagueFinalsRegistry(input.standings);
  const authoritativeMatches = (sharedRegistry.length ? sharedRegistry : input.matches).filter((match) => match.authoritative);
  const resultNormalization = normalizeLeagueFinalsResults(authoritativeMatches, input.results);
  const reconciledResults = resultNormalization.results;
  const missingResults = authoritativeMatches
    .filter((match) => !reconciledResults.some((result) => result.matchId === match.id))
    .map((match) => `${match.night} Match ${match.matchNumber} (${match.kind})`);
  const invalidResults = authoritativeMatches.flatMap((match) => {
    const matching = reconciledResults.filter((result) => result.matchId === match.id);
    if (matching.length > 1) return [`${match.id}: duplicate League Finals results.`];
    if (matching.length !== 1) return [];
    if (!["Winner", "No Contest"].includes(matching[0].resultType as string)) {
      return [`${match.id}: DQ/unsupported ending is ambiguous without caused-by-wrestler metadata.`];
    }
    return validateLeagueFinalsResult(matching[0], authoritativeMatches, reconciledResults);
  });
  invalidResults.push(...resultNormalization.duplicateCanonicalResultIds.map((key) => `${key}: duplicate League Finals results.`));
  invalidResults.push(...resultNormalization.unmatchedSavedResultKeys.map((key) => `${key}: saved League Finals result could not be reconciled to an authoritative canonical match ID.`));

  const reviewRequired: string[] = [];
  const openReviews = (input.manualReviews ?? []).filter((review) => review.status === "open");
  if (openReviews.length) reviewRequired.push(`${openReviews.length} open Manual Review item(s) block Post-Finals Transition.`);
  const unresolvedTies = input.consequentialTies.filter(
    (tie) => tie.status === "Tiebreaker Match Required" || tie.status === "Review Required",
  );
  if (unresolvedTies.length) reviewRequired.push(`${unresolvedTies.length} required tiebreaker state(s) remain unresolved.`);

  const assignments = input.standings.map<PostFinalsAssignment>((row) => ({
    wrestler: row.wrestler,
    priorLeague: row.league,
    priorRank: row.rank,
    newLeague: row.league,
    movement: row.rank === 1 ? "Champion/direct promotion" : "Retained lower league",
    finalsOutcome: null,
  }));
  const assignmentByWrestler = new Map(assignments.map((assignment) => [assignment.wrestler, assignment]));
  for (const movement of input.directMovements) {
    const assignment = assignmentByWrestler.get(movement.wrestler);
    if (!assignment) {
      reviewRequired.push(`${movement.wrestler}: direct movement has no final-standing assignment.`);
      continue;
    }
    assignment.newLeague = movement.toLeague;
    assignment.movement = movementForDirect(movement);
    assignment.finalsOutcome = movement.reason;
  }

  const relegationOutcomes: RelegationOutcome[] = [];
  for (const match of authoritativeMatches.filter((candidate) => candidate.kind === "Relegation")) {
    const result = reconciledResults.find((candidate) => candidate.matchId === match.id);
    const higher = match.wrestlerA;
    const lower = match.wrestlerB;
    if (!higher || !lower || !match.higherLeague || !match.lowerLeague || !result) continue;
    const higherAssignment = assignmentByWrestler.get(higher);
    const lowerAssignment = assignmentByWrestler.get(lower);
    if (!higherAssignment || !lowerAssignment) continue;

    const rawType = result.resultType as string;
    if (rawType === "Disqualification" || !["Winner", "No Contest"].includes(rawType)) {
      const warning = `${match.id}: DQ/unsupported ending does not identify the wrestler who caused it. Review Required.`;
      reviewRequired.push(warning);
      relegationOutcomes.push({
        matchId: match.id, higherLeague: match.higherLeague, lowerLeague: match.lowerLeague,
        higherLeagueWrestler: higher, lowerLeagueWrestler: lower, winner: result.winner, loser: null,
        outcome: "Review Required",
      });
      continue;
    }

    const lowerWon = result.resultType === "Winner" && result.winner === lower;
    higherAssignment.newLeague = lowerWon ? match.lowerLeague : match.higherLeague;
    lowerAssignment.newLeague = lowerWon ? match.higherLeague : match.lowerLeague;
    higherAssignment.movement = lowerWon ? "Relegated" : "Retained higher league";
    lowerAssignment.movement = lowerWon ? "Promoted" : "Retained lower league";
    higherAssignment.finalsOutcome = lowerWon ? `Lost to ${lower}` : result.resultType === "No Contest" ? "No Contest retention" : `Defeated ${lower}`;
    lowerAssignment.finalsOutcome = lowerWon ? `Defeated ${higher}` : result.resultType === "No Contest" ? "No Contest retention" : `Lost to ${higher}`;
    relegationOutcomes.push({
      matchId: match.id,
      higherLeague: match.higherLeague,
      lowerLeague: match.lowerLeague,
      higherLeagueWrestler: higher,
      lowerLeagueWrestler: lower,
      winner: result.resultType === "Winner" ? result.winner : null,
      loser: result.resultType === "Winner" ? (result.winner === higher ? lower : higher) : null,
      outcome: result.resultType === "No Contest" ? "No Contest retention" : lowerWon ? "Lower promoted" : "Higher retained",
    });
  }

  const openingSplitComplete = input.completedThroughWeek >= 22 && unresolvedTies.length === 0;
  const finalsComplete = openReviews.length === 0 && nightCompletion["Night One"] && nightCompletion["Night Two"]
    && missingResults.length === 0 && invalidResults.length === 0;
  const preliminaryCompositionErrors = validateComposition(assignments, input.standings);
  const unlocked = openingSplitComplete && finalsComplete && preliminaryCompositionErrors.length === 0;
  const compositionErrors = preliminaryCompositionErrors;
  const compositionValid = unlocked && compositionErrors.length === 0 && !reviewRequired.some((item) => item.includes("DQ/unsupported"));

  const leagueComposition = defaultComposition();
  for (const assignment of assignments) leagueComposition[assignment.newLeague].push(assignment);
  const proposedOrder = LEAGUE_NAMES.map((league) => ({
    league,
    reviewRequired: true as const,
    wrestlers: [...leagueComposition[league]].sort(proposedSort),
  }));

  const eliteFinal = authoritativeMatches.find((match) => match.kind === "Elite Cup Final");
  const eliteResult = eliteFinal && reconciledResults.find((result) => result.matchId === eliteFinal.id);
  const eliteParticipants = eliteFinal ? resolveFinalsParticipants(eliteFinal, reconciledResults) : [null, null];
  const legacyFacts: LegacyFact[] = input.champions.map((champion) => ({
    label: `${champion.league.replace(" League", "")} League Champion`,
    wrestler: champion.wrestler,
    detail: champion.league === "Global League" ? "Champion independent of the Elite Cup result." : "League champion and direct promotion winner.",
  }));
  if (eliteResult?.winner) {
    legacyFacts.push({ label: "Global Elite Cup Winner", wrestler: eliteResult.winner, detail: "Separate event achievement." });
    const runnerUp = eliteParticipants.find((participant) => participant && participant !== eliteResult.winner);
    if (runnerUp) legacyFacts.push({ label: "Global Elite Cup Runner-up", wrestler: runnerUp, detail: "Elite Cup finalist." });
  }
  for (const movement of input.directMovements) {
    legacyFacts.push({
      label: movement.reason === "Direct promotion" ? "Direct Promotion" : "Direct Relegation",
      wrestler: movement.wrestler,
      detail: `${movement.fromLeague} → ${movement.toLeague}.`,
    });
  }
  for (const outcome of relegationOutcomes) {
    if (outcome.winner && outcome.loser) {
      legacyFacts.push({ label: "Relegation Match Winner", wrestler: outcome.winner, detail: outcome.matchId });
      legacyFacts.push({ label: "Relegation Match Loser", wrestler: outcome.loser, detail: outcome.matchId });
      if (outcome.outcome === "Higher retained") {
        legacyFacts.push({ label: "Successful League Retention", wrestler: outcome.higherLeagueWrestler, detail: outcome.matchId });
      }
    } else if (outcome.outcome === "No Contest retention") {
      legacyFacts.push({ label: "Successful League Retention", wrestler: outcome.higherLeagueWrestler, detail: "Retained higher league after No Contest / unclear ending." });
    }
  }
  for (const row of input.standings.filter((standing) => standing.matches === 22 && standing.wins === 22 && standing.draws === 0 && standing.losses === 0)) {
    legacyFacts.push({ label: "Undefeated / Invincible Opening Split", wrestler: row.wrestler, detail: "22 wins from 22 matches in final standings." });
  }
  const beckielo = assignments.find((assignment) => assignment.wrestler.toLowerCase() === "beckielo");
  if (beckielo) legacyFacts.push({
    label: "Beckielo Opening Split Result",
    wrestler: beckielo.wrestler,
    detail: `${beckielo.priorLeague} #${beckielo.priorRank}; proposed next split: ${beckielo.newLeague}.`,
  });

  reviewRequired.push("Proposed seed order / Review Required: objective prior tier, prior rank, finals outcome, and champion/direct-promotion status are shown; seed is not used as a tiebreaker.");
  reviewRequired.push("Legacy formula Review Required: factual achievements are preserved without GOAT points or subjective rankings.");
  const closingSplitSetupReady = compositionValid && input.hasAuthoritativeClosingSchedule
    && !reviewRequired.some((item) => item.includes("DQ/unsupported"));

  return {
    unlocked,
    lockedMessage: unlocked ? null : "Post-Finals Transition locked: complete League Finals first.",
    finalsComplete,
    nightCompletion,
    missingResults,
    invalidResults,
    champions: input.champions,
    directMovements: input.directMovements,
    relegationOutcomes,
    assignments,
    leagueComposition,
    compositionValid,
    compositionErrors,
    proposedOrder,
    legacyFacts,
    warnings: ["No workbook cells are mutated.", "No Closing Split fixtures or normal Week 25 workflow are generated automatically."],
    reviewRequired,
    openingSplitComplete,
    closingSplitSetupReady,
    hasAuthoritativeClosingSchedule: input.hasAuthoritativeClosingSchedule,
    closingScheduleMessage: input.hasAuthoritativeClosingSchedule
      ? null
      : "Closing Split schedule source missing: create or import schedule before starting Week 25.",
    week25Generated: false,
    diagnostics: {
      savedLeagueFinalsResultKeys: input.results.map((result) => result.matchId),
      canonicalAuthoritativeFinalsMatchIds: resultNormalization.canonicalMatchIds,
      migratedLegacyResultKeysCount: resultNormalization.migratedLegacyResultKeys.length,
      unmatchedSavedResultsCount: resultNormalization.unmatchedSavedResultKeys.length,
      missingAuthoritativeFinalsCount: missingResults.length,
      missingCanonicalIds: authoritativeMatches
        .filter((match) => !reconciledResults.some((result) => result.matchId === match.id))
        .map((match) => match.id),
      extraUnmatchedSavedIds: resultNormalization.unmatchedSavedResultKeys,
    },
  };
}
