import type { ConsequentialTieReview } from "./split-completion";
import type { LeagueName, StandingRow } from "./types";
import type { ManualReview } from "./tracker-state";

export type FinalsNight = "Night One" | "Night Two";
export type FinalsMatchKind = "Relegation" | "Elite Cup Semifinal" | "Elite Cup Final";
export type FinalsResultType = "Winner" | "No Contest";

export interface LeagueFinalsMatch {
  id: string;
  night: FinalsNight;
  matchNumber: number;
  kind: FinalsMatchKind;
  wrestlerA: string | null;
  wrestlerB: string | null;
  higherLeague: LeagueName | null;
  lowerLeague: LeagueName | null;
  stipulation: string;
  resultMeaning: string;
  authoritative: boolean;
  sourceLabel: string;
}

export interface LeagueFinalsResult {
  matchId: string;
  resultType: FinalsResultType;
  winner: string | null;
  confirmedAt: string;
  matchIdentity?: string;
}

export interface DirectMovement {
  wrestler: string;
  fromLeague: LeagueName;
  toLeague: LeagueName;
  reason: "Direct promotion" | "Direct relegation";
}

export interface LeagueFinalsSourceAuditRow {
  league: LeagueName;
  ranks: { rank: number; wrestler: string | null; league: LeagueName }[];
}

export interface LeagueFinalsReview {
  ready: boolean;
  readinessLabel: "Ready" | "Blocked" | "Review Required";
  readinessReasons: string[];
  champions: { league: LeagueName; wrestler: string }[];
  directMovements: DirectMovement[];
  relegationMatches: LeagueFinalsMatch[];
  eliteCupQualifiers: StandingRow[];
  nightOne: LeagueFinalsMatch[];
  nightTwo: LeagueFinalsMatch[];
  reviewRequired: string[];
  sourceWarnings: string[];
  sourceAudit: LeagueFinalsSourceAuditRow[];
}

interface LeagueFinalsInput {
  completedThroughWeek: number;
  standings: StandingRow[];
  consequentialTies: ConsequentialTieReview[];
  hasLeagueFinalsTemplate: boolean;
}

const leagueOrder: LeagueName[] = [
  "Global League",
  "Continental League",
  "National League",
  "Regional League",
];

function rowAt(standings: StandingRow[], league: LeagueName, rank: number): StandingRow | undefined {
  return standings.find((row) => row.league === league && row.rank === rank);
}

const auditRanks = [1, 2, 3, 4, 9, 10, 11, 12];

function buildSourceAudit(standings: StandingRow[]): LeagueFinalsSourceAuditRow[] {
  return leagueOrder.map((league) => ({
    league,
    ranks: auditRanks.map((rank) => ({ rank, wrestler: rowAt(standings, league, rank)?.wrestler ?? null, league })),
  }));
}

function buildFinalsMatchId(match: Omit<LeagueFinalsMatch, "id">): string {
  return buildLeagueFinalsMatchIdentity({ ...match, id: "" });
}

function validateFinalStandingsSource(standings: StandingRow[], completedThroughWeek: number): string[] {
  const errors: string[] = [];
  if (completedThroughWeek < 22) errors.push("League Finals source standings are invalid or stale.");
  const leagues = new Set(standings.map((row) => row.league));
  if (leagues.size !== 4 || !leagueOrder.every((league) => leagues.has(league))) errors.push("League Finals source standings are invalid or stale.");
  for (const league of leagueOrder) {
    const rows = standings.filter((row) => row.league === league);
    if (rows.length !== 12) errors.push("League Finals source standings are invalid or stale.");
    for (let rank = 1; rank <= 12; rank += 1) {
      if (rows.filter((row) => row.rank === rank).length !== 1) errors.push("League Finals source standings are invalid or stale.");
    }
    if (rows.some((row) => row.matches < 22)) errors.push("League Finals source standings are invalid or stale.");
  }
  const names = standings.map((row) => row.wrestler.trim().toLowerCase()).filter(Boolean);
  if (names.length !== 48 || new Set(names).size !== names.length) errors.push("League Finals source standings are invalid or stale.");
  return [...new Set(errors)];
}

function finalsIdentityPart(value: string | number | null | undefined): string {
  return `${value ?? "unresolved"}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unresolved";
}

export function buildLeagueFinalsMatchIdentity(match: LeagueFinalsMatch): string {
  return [
    "league-finals",
    match.night,
    match.kind,
    match.matchNumber,
    match.higherLeague,
    match.lowerLeague,
    match.wrestlerA,
    match.wrestlerB,
  ].map(finalsIdentityPart).join(":");
}

const allowedRelegationPairs = new Set([
  "National League->Regional League",
  "Continental League->National League",
  "Global League->Continental League",
]);

export function validateLeagueFinalsMatchSource(match: LeagueFinalsMatch): string[] {
  if (match.kind !== "Relegation") return [];
  const errors: string[] = [];
  const pair = `${match.higherLeague}->${match.lowerLeague}`;
  if (!match.higherLeague || !match.lowerLeague || !allowedRelegationPairs.has(pair)) {
    errors.push(`${match.id}: invalid relegation playoff league pairing (${match.higherLeague ?? "missing"} vs ${match.lowerLeague ?? "missing"}). Relegation playoffs must be Global vs Continental, Continental vs National, or National vs Regional.`);
  }
  if (match.higherLeague && match.lowerLeague && match.higherLeague === match.lowerLeague) {
    errors.push(`${match.id}: invalid same-league relegation playoff (${match.higherLeague}).`);
  }
  return errors;
}

function relegationMatch(
  standings: StandingRow[],
  night: FinalsNight,
  matchNumber: number,
  higherLeague: LeagueName,
  higherRank: number,
  lowerLeague: LeagueName,
  lowerRank: number,
): LeagueFinalsMatch {
  const higher = rowAt(standings, higherLeague, higherRank);
  const lower = rowAt(standings, lowerLeague, lowerRank);
  const match: Omit<LeagueFinalsMatch, "id"> = {
    night,
    matchNumber,
    kind: "Relegation",
    wrestlerA: higher?.wrestler ?? null,
    wrestlerB: lower?.wrestler ?? null,
    higherLeague,
    lowerLeague,
    stipulation: "1v1, No Countout",
    resultMeaning: `Winner plays next split/season in ${higherLeague}; loser plays in ${lowerLeague}.`,
    authoritative: Boolean(higher && lower),
    sourceLabel: "Final live standings after Week 22 lock: promotion/relegation playoff slot",
  };
  return { ...match, id: buildFinalsMatchId(match) };
}

export function deriveLeagueFinalsFromFinalLiveStandings(input: LeagueFinalsInput): LeagueFinalsReview {
  const unresolvedTies = input.consequentialTies.filter(
    (tie) => tie.status === "Tiebreaker Match Required" || tie.status === "Review Required",
  );
  const completeStandings = leagueOrder.every(
    (league) => Array.from({ length: 12 }, (_, index) => rowAt(input.standings, league, index + 1)).every(Boolean),
  );
  const readinessReasons: string[] = validateFinalStandingsSource(input.standings, input.completedThroughWeek);
  if (input.completedThroughWeek < 22 && !readinessReasons.length) readinessReasons.push("Opening Split regular season is not complete through Week 22.");
  if (unresolvedTies.length) readinessReasons.push(`${unresolvedTies.length} consequential tiebreaker group(s) remain unresolved.`);
  if (!completeStandings && !readinessReasons.length) readinessReasons.push("League Finals source standings are invalid or stale.");

  const champions = leagueOrder.flatMap((league) => {
    const champion = rowAt(input.standings, league, 1);
    return champion ? [{ league, wrestler: champion.wrestler }] : [];
  });
  const directMovements: DirectMovement[] = [];
  for (let index = 1; index < leagueOrder.length; index += 1) {
    const promoted = rowAt(input.standings, leagueOrder[index], 1);
    if (promoted) directMovements.push({
      wrestler: promoted.wrestler,
      fromLeague: leagueOrder[index],
      toLeague: leagueOrder[index - 1],
      reason: "Direct promotion",
    });
  }
  for (let index = 0; index < leagueOrder.length - 1; index += 1) {
    const relegated = rowAt(input.standings, leagueOrder[index], 12);
    if (relegated) directMovements.push({
      wrestler: relegated.wrestler,
      fromLeague: leagueOrder[index],
      toLeague: leagueOrder[index + 1],
      reason: "Direct relegation",
    });
  }

  const relegationMatches = [
    relegationMatch(input.standings, "Night One", 1, "National League", 11, "Regional League", 2),
    relegationMatch(input.standings, "Night One", 2, "National League", 10, "Regional League", 3),
    relegationMatch(input.standings, "Night One", 3, "National League", 9, "Regional League", 4),
    relegationMatch(input.standings, "Night One", 4, "Continental League", 11, "National League", 2),
    relegationMatch(input.standings, "Night One", 5, "Continental League", 10, "National League", 3),
    relegationMatch(input.standings, "Night One", 6, "Continental League", 9, "National League", 4),
    relegationMatch(input.standings, "Night Two", 1, "Global League", 11, "Continental League", 2),
    relegationMatch(input.standings, "Night Two", 2, "Global League", 10, "Continental League", 3),
    relegationMatch(input.standings, "Night Two", 3, "Global League", 9, "Continental League", 4),
  ];
  const eliteCupQualifiers = input.standings
    .filter((row) => row.league === "Global League" && row.rank <= 4)
    .sort((a, b) => a.rank - b.rank);
  const eliteBase: Omit<LeagueFinalsMatch, "id">[] = [
    {
      night: "Night Two", matchNumber: 4, kind: "Elite Cup Semifinal",
      wrestlerA: rowAt(input.standings, "Global League", 1)?.wrestler ?? null,
      wrestlerB: rowAt(input.standings, "Global League", 4)?.wrestler ?? null,
      higherLeague: null, lowerLeague: null, stipulation: "Steel Cage No Escape, Pin/Sub only",
      resultMeaning: "Winner advances to the Global Elite Cup Final.", authoritative: eliteCupQualifiers.length === 4,
      sourceLabel: "Final live standings after Week 22 lock: Global #1 vs Global #4",
    },
    {
      night: "Night Two", matchNumber: 5, kind: "Elite Cup Semifinal",
      wrestlerA: rowAt(input.standings, "Global League", 2)?.wrestler ?? null,
      wrestlerB: rowAt(input.standings, "Global League", 3)?.wrestler ?? null,
      higherLeague: null, lowerLeague: null, stipulation: "Steel Cage No Escape, Pin/Sub only",
      resultMeaning: "Winner advances to the Global Elite Cup Final.", authoritative: eliteCupQualifiers.length === 4,
      sourceLabel: "Final live standings after Week 22 lock: Global #2 vs Global #3",
    },
    {
      night: "Night Two", matchNumber: 6, kind: "Elite Cup Final",
      wrestlerA: null, wrestlerB: null, higherLeague: null, lowerLeague: null,
      stipulation: "Steel Cage No Escape, Pin/Sub only", resultMeaning: "Winner becomes Global Elite Cup Winner.",
      authoritative: true, sourceLabel: "Final live standings after Week 22 lock: winners of SF1 and SF2",
    },
  ];
  const eliteMatches: LeagueFinalsMatch[] = eliteBase.map((match) => ({ ...match, id: buildFinalsMatchId(match) }));
  const relegationValidationErrors = relegationMatches.flatMap(validateLeagueFinalsMatchSource);
  readinessReasons.push(...relegationValidationErrors);
  const safeRelegationMatches = relegationValidationErrors.length ? [] : relegationMatches;
  const reviewRequired = [];
  reviewRequired.push("DQ encoding: current event result model does not safely identify the wrestler who caused a DQ.");
  reviewRequired.push("Manual card padding required if WWE 2K requires more matches; no filler is generated.");

  return {
    ready: readinessReasons.length === 0,
    readinessLabel: readinessReasons.length ? "Blocked" : reviewRequired.length ? "Review Required" : "Ready",
    readinessReasons,
    champions,
    directMovements,
    relegationMatches: readinessReasons.length ? [] : safeRelegationMatches,
    eliteCupQualifiers,
    nightOne: readinessReasons.length ? [] : safeRelegationMatches.filter((match) => match.night === "Night One"),
    nightTwo: readinessReasons.length ? [] : [...safeRelegationMatches.filter((match) => match.night === "Night Two"), ...eliteMatches],
    reviewRequired,
    sourceAudit: buildSourceAudit(input.standings),
    sourceWarnings: [
      "League Finals results are browser-local event results and do not mutate the workbook.",
      "League Finals completion does not create Week 25, a Closing Split, or post-finals league rosters.",
    ],
  };
}

export function resolveFinalsParticipants(
  match: LeagueFinalsMatch,
  results: LeagueFinalsResult[],
): [string | null, string | null] {
  if (match.kind !== "Elite Cup Final") return [match.wrestlerA, match.wrestlerB];
  return [
    results.find((result) => result.matchId.includes("elite-cup-semifinal") && result.matchId.includes("4"))?.winner ?? null,
    results.find((result) => result.matchId.includes("elite-cup-semifinal") && result.matchId.includes("5"))?.winner ?? null,
  ];
}

export function validateLeagueFinalsResult(
  result: LeagueFinalsResult,
  matches: LeagueFinalsMatch[],
  existingResults: LeagueFinalsResult[] = [],
): string[] {
  const match = matches.find((candidate) => candidate.id === result.matchId);
  if (!match || !match.authoritative) return [`${result.matchId}: League Finals match is not authoritative or confirmed.`];
  if (result.matchIdentity && result.matchIdentity !== buildLeagueFinalsMatchIdentity(match)) {
    return [`${result.matchId}: saved result belongs to a different League Finals matchup.`];
  }
  const participants = resolveFinalsParticipants(match, existingResults);
  if (participants.some((participant) => !participant)) return [`${result.matchId}: participants are not yet resolved.`];
  if (result.resultType === "Winner" && !participants.includes(result.winner)) {
    return [`${result.matchId}: winner must be one of the derived participants.`];
  }
  if (result.resultType === "No Contest" && result.winner !== null) {
    return [`${result.matchId}: No Contest cannot have a winner.`];
  }
  if (result.resultType === "No Contest" && match.kind !== "Relegation") {
    return [`${result.matchId}: No Contest fallback is only defined here for relegation matches.`];
  }
  return [];
}

export function sanitizeLeagueFinalsResults(
  matches: LeagueFinalsMatch[],
  results: LeagueFinalsResult[],
): LeagueFinalsResult[] {
  const sanitized: LeagueFinalsResult[] = [];
  for (const result of results) {
    const match = matches.find((candidate) => candidate.id === result.matchId);
    if (!match) continue;
    const participantResults = [...sanitized, ...results.filter((candidate) => candidate.matchId !== result.matchId)];
    if (validateLeagueFinalsResult(result, matches, participantResults).length) continue;
    if (!result.matchIdentity && result.resultType === "Winner") {
      const participants = resolveFinalsParticipants(match, participantResults);
      if (!participants.includes(result.winner)) continue;
    }
    sanitized.push(result.matchIdentity ? result : { ...result, matchIdentity: buildLeagueFinalsMatchIdentity(match) });
  }
  return sanitized;
}

export function relegationHigherLeagueWrestler(
  match: LeagueFinalsMatch,
  result: LeagueFinalsResult,
): string | null {
  if (match.kind !== "Relegation") return null;
  return result.resultType === "No Contest" ? match.wrestlerA : result.winner;
}

export function validateFinalsNightCompletion(
  night: FinalsNight,
  matches: LeagueFinalsMatch[],
  results: LeagueFinalsResult[],
  manualReviews: ManualReview[] = [],
): string[] {
  const errors = matches.filter((match) => match.night === night && match.authoritative).flatMap((match) => {
    const result = results.find((candidate) => candidate.matchId === match.id);
    return result ? validateLeagueFinalsResult(result, matches, results) : [`${match.id}: result is required.`];
  });
  errors.push(...manualReviews.filter((review) => review.scope === "league-finals" && review.status === "open" && review.weekOrEvent === night)
    .map((review) => `${review.matchId}: open Manual Review must be resolved or cleared before ${night} can be completed.`));
  return errors;
}

export function deriveLeagueFinalsReview(input: LeagueFinalsInput): LeagueFinalsReview {
  return deriveLeagueFinalsFromFinalLiveStandings(input);
}
