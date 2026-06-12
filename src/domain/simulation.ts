import type {
  League,
  LeagueName,
  Match,
  MatchResult,
  MatchupReferenceRow,
  StandingRow,
  StreakRecord,
} from "./types";

export type SimulationOutcome = "decisive" | "draw" | "no-contest";
export type FavoriteLabel = "Clear favorite" | "Light favorite" | "Even matchup";

export interface SimulationProfile {
  wrestler: string;
  seed: number;
  standingRank: number;
  points: number;
  currentWinningStreak: number;
  longestWinningStreak: number;
}

export interface SimulationCandidate {
  match: Match;
  wrestlerA: SimulationProfile;
  wrestlerB: SimulationProfile;
}

export interface SimulationPreview {
  matchId: string;
  league: LeagueName;
  week: number;
  matchNumber: number;
  wrestlerA: string;
  wrestlerB: string;
  outcome: SimulationOutcome;
  winner: string | null;
  favorite: string | null;
  favoriteProbability: number;
  favoriteLabel: FavoriteLabel;
  upset: boolean;
  reason: string;
}

export interface SimulationValidationInput {
  matchId: string;
  outcome: SimulationOutcome;
  winner: string | null;
}

export interface SimulationValidationResult {
  valid: boolean;
  errors: string[];
}

const DRAW_CHANCE = 0.01;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateSimulationRating(profile: SimulationProfile): number {
  const seedPrestige = (13 - profile.seed) * 2;
  const standingStrength = (13 - profile.standingRank) * 2.5;
  const pointsForm = profile.points * 0.35;
  const currentForm = profile.currentWinningStreak * 1.75;
  const provenCeiling = profile.longestWinningStreak * 0.65;
  return seedPrestige + standingStrength + pointsForm + currentForm + provenCeiling;
}

export function calculateFavoriteProbability(ratingA: number, ratingB: number): number {
  const difference = Math.abs(ratingA - ratingB);
  if (difference < 2) return 0.5;
  return clamp(0.52 + difference / 100, 0.55, 0.78);
}

function favoriteLabel(probability: number): FavoriteLabel {
  if (probability >= 0.7) return "Clear favorite";
  if (probability >= 0.55) return "Light favorite";
  return "Even matchup";
}

export function buildSimulationCandidates(input: {
  matches: Match[];
  matchupReference: MatchupReferenceRow[];
  leagues: League[];
  standings: StandingRow[];
  streaks: StreakRecord[];
  existingResults: MatchResult[];
  userLeague: LeagueName;
}): { week: number | null; candidates: SimulationCandidate[]; excludedLeague: LeagueName } {
  const completedIds = new Set(input.existingResults.map((result) => result.matchId));
  const openMatches = input.matches.filter((match) => match.status === "scheduled" && !completedIds.has(match.id));
  const week = openMatches.length ? Math.min(...openMatches.map((match) => match.week)) : null;
  if (week === null) return { week, candidates: [], excludedLeague: input.userLeague };

  const leagueByName = new Map(input.leagues.map((league) => [league.name, league]));
  const standingByWrestler = new Map(input.standings.map((row) => [`${row.league}:${row.wrestler}`, row]));
  const streakByWrestler = new Map(input.streaks.map((row) => [`${row.league}:${row.wrestler}`, row]));
  const referenceKeys = new Set(
    input.matchupReference
      .filter((reference) => reference.week === week)
      .map((reference) => `${reference.league}:${reference.week}:${reference.matchNumber}:${reference.matchupKey}`),
  );

  function profile(match: Match, wrestler: string): SimulationProfile {
    const membership = leagueByName.get(match.league)?.wrestlers.find((entry) => entry.wrestler.name === wrestler);
    const standing = standingByWrestler.get(`${match.league}:${wrestler}`);
    const streak = streakByWrestler.get(`${match.league}:${wrestler}`);
    if (!membership || !standing || !streak) {
      throw new Error(`Missing simulation profile data for ${wrestler} in ${match.league}.`);
    }
    return {
      wrestler,
      seed: membership.seed,
      standingRank: standing.rank,
      points: standing.points,
      currentWinningStreak: streak.currentStreak,
      longestWinningStreak: streak.longestWinningStreak,
    };
  }

  const candidates = openMatches
    .filter((match) => match.week === week && match.league !== input.userLeague)
    .filter((match) => referenceKeys.has(`${match.league}:${match.week}:${match.matchNumber}:${match.matchupKey}`))
    .sort((a, b) => a.showDay.localeCompare(b.showDay) || a.matchNumber - b.matchNumber)
    .map((match) => ({ match, wrestlerA: profile(match, match.wrestlerA), wrestlerB: profile(match, match.wrestlerB) }));

  return { week, candidates, excludedLeague: input.userLeague };
}

export function simulateMatch(candidate: SimulationCandidate, random: () => number = Math.random): SimulationPreview {
  const ratingA = calculateSimulationRating(candidate.wrestlerA);
  const ratingB = calculateSimulationRating(candidate.wrestlerB);
  const probability = calculateFavoriteProbability(ratingA, ratingB);
  const favorite = ratingA === ratingB ? null : ratingA > ratingB ? candidate.wrestlerA.wrestler : candidate.wrestlerB.wrestler;
  const underdog = favorite === candidate.wrestlerA.wrestler ? candidate.wrestlerB.wrestler : candidate.wrestlerA.wrestler;
  const label = favoriteLabel(probability);
  const drawRoll = random();

  if (drawRoll < DRAW_CHANCE) {
    return {
      matchId: candidate.match.id,
      league: candidate.match.league,
      week: candidate.match.week,
      matchNumber: candidate.match.matchNumber,
      wrestlerA: candidate.match.wrestlerA,
      wrestlerB: candidate.match.wrestlerB,
      outcome: "draw",
      winner: null,
      favorite,
      favoriteProbability: probability,
      favoriteLabel: label,
      upset: false,
      reason: "Very rare draw outcome (1% simulation chance); no winner is assigned.",
    };
  }

  const resultRoll = random();
  let winner: string;
  if (!favorite) {
    winner = resultRoll < 0.5 ? candidate.match.wrestlerA : candidate.match.wrestlerB;
  } else {
    winner = resultRoll < probability ? favorite : underdog;
  }
  const upset = Boolean(favorite && winner !== favorite);
  const favoriteProfile = ratingA >= ratingB ? candidate.wrestlerA : candidate.wrestlerB;
  const otherProfile = ratingA >= ratingB ? candidate.wrestlerB : candidate.wrestlerA;
  const reason = favorite
    ? `${favorite} is the ${label.toLowerCase()} from seed/prestige, rank, points, and streak form (${Math.round(probability * 100)}% weighted win chance). ${favoriteProfile.wrestler} ranks #${favoriteProfile.standingRank} with a ${favoriteProfile.currentWinningStreak}-match current streak; ${otherProfile.wrestler} ranks #${otherProfile.standingRank}.`
    : "Ratings are effectively even, so the decisive result is close to 50/50.";

  return {
    matchId: candidate.match.id,
    league: candidate.match.league,
    week: candidate.match.week,
    matchNumber: candidate.match.matchNumber,
    wrestlerA: candidate.match.wrestlerA,
    wrestlerB: candidate.match.wrestlerB,
    outcome: "decisive",
    winner,
    favorite,
    favoriteProbability: probability,
    favoriteLabel: label,
    upset,
    reason: upset ? `Upset: ${winner} beat weighted favorite ${favorite}. ${reason}` : reason,
  };
}

export function simulateMatches(candidates: SimulationCandidate[], random: () => number = Math.random): SimulationPreview[] {
  return candidates.map((candidate) => simulateMatch(candidate, random));
}

export function validateSimulatedResults(input: {
  results: SimulationValidationInput[];
  scheduledMatches: Match[];
  existingResults: MatchResult[];
  userLeague: LeagueName;
}): SimulationValidationResult {
  const errors: string[] = [];
  const scheduledById = new Map(input.scheduledMatches.map((match) => [match.id, match]));
  const existingIds = new Set(input.existingResults.map((result) => result.matchId));
  const seen = new Set<string>();

  for (const result of input.results) {
    const match = scheduledById.get(result.matchId);
    if (!match) {
      errors.push(`${result.matchId}: matchup is not in the authoritative schedule.`);
      continue;
    }
    if (match.league === input.userLeague) errors.push(`${result.matchId}: the user-controlled ${input.userLeague} cannot be simulated.`);
    if (match.status !== "scheduled") errors.push(`${result.matchId}: matchup is not open for simulation.`);
    if (existingIds.has(result.matchId)) errors.push(`${result.matchId}: a workbook result already exists.`);
    if (seen.has(result.matchId)) errors.push(`${result.matchId}: duplicate simulated result.`);
    seen.add(result.matchId);

    if (result.outcome === "decisive") {
      if (result.winner !== match.wrestlerA && result.winner !== match.wrestlerB) {
        errors.push(`${result.matchId}: winner must be one of the scheduled wrestlers.`);
      }
    } else if (result.winner !== null) {
      errors.push(`${result.matchId}: Draw or No Contest cannot have a winner.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
