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
  outcome?: string | null;
  label?: string | null;
  participantSnapshot?: unknown;
  winnerSide?: string | number | null;
  selectedParticipant?: string | number | null;
  selectedSide?: string | number | null;
  participantSide?: string | number | null;
  winnerIndex?: number | null;
  winnerName?: string | null;
  selectedWinner?: string | null;
  selectedResult?: string | null;
  result?: string | null;
  value?: string | number | null;
  selection?: string | number | null;
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
  finalStandingsValid: boolean;
  unresolvedTiebreakerCount: number;
  cardRenderability: {
    renderable: boolean;
    nightOneGeneratedCount: number;
    nightTwoGeneratedCount: number;
    hiddenReasons: string[];
  };
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

export function buildCanonicalLeagueFinalsMatchId(night: FinalsNight, matchNumber: number): string {
  return ["league-finals", finalsIdentityPart(night), `match-${matchNumber}`].join(":");
}

function buildFinalsMatchId(match: Omit<LeagueFinalsMatch, "id">): string {
  return buildCanonicalLeagueFinalsMatchId(match.night, match.matchNumber);
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

export function buildLeagueFinalsResultIdentity(
  match: LeagueFinalsMatch,
  results: LeagueFinalsResult[] = [],
): string {
  const [participantA, participantB] = resolveFinalsParticipants(match, results);
  return [
    "league-finals",
    match.night,
    match.kind,
    match.matchNumber,
    match.higherLeague,
    match.lowerLeague,
    participantA,
    participantB,
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

/**
 * Builds the single canonical 12-slot League Finals registry used for both
 * result entry and Post-Finals reconciliation. This helper intentionally does
 * not inspect readiness warnings (manual padding, DQ encoding, completion
 * locks, browser-local storage, etc.) so those warnings cannot empty the
 * authoritative slot registry when final live standings are otherwise valid.
 */
export function buildCanonicalLeagueFinalsRegistry(finalLiveStandings: StandingRow[]): LeagueFinalsMatch[] {
  const relegationMatches = [
    relegationMatch(finalLiveStandings, "Night One", 1, "National League", 11, "Regional League", 2),
    relegationMatch(finalLiveStandings, "Night One", 2, "National League", 10, "Regional League", 3),
    relegationMatch(finalLiveStandings, "Night One", 3, "National League", 9, "Regional League", 4),
    relegationMatch(finalLiveStandings, "Night One", 4, "Continental League", 11, "National League", 2),
    relegationMatch(finalLiveStandings, "Night One", 5, "Continental League", 10, "National League", 3),
    relegationMatch(finalLiveStandings, "Night One", 6, "Continental League", 9, "National League", 4),
    relegationMatch(finalLiveStandings, "Night Two", 1, "Global League", 11, "Continental League", 2),
    relegationMatch(finalLiveStandings, "Night Two", 2, "Global League", 10, "Continental League", 3),
    relegationMatch(finalLiveStandings, "Night Two", 3, "Global League", 9, "Continental League", 4),
  ];
  const eliteCupQualifiers = finalLiveStandings
    .filter((row) => row.league === "Global League" && row.rank <= 4)
    .sort((a, b) => a.rank - b.rank);
  const eliteBase: Omit<LeagueFinalsMatch, "id">[] = [
    {
      night: "Night Two", matchNumber: 4, kind: "Elite Cup Semifinal",
      wrestlerA: rowAt(finalLiveStandings, "Global League", 1)?.wrestler ?? null,
      wrestlerB: rowAt(finalLiveStandings, "Global League", 4)?.wrestler ?? null,
      higherLeague: null, lowerLeague: null, stipulation: "Steel Cage No Escape, Pin/Sub only",
      resultMeaning: "Winner advances to the Global Elite Cup Final.", authoritative: eliteCupQualifiers.length === 4,
      sourceLabel: "Final live standings after Week 22 lock: Global #1 vs Global #4",
    },
    {
      night: "Night Two", matchNumber: 5, kind: "Elite Cup Semifinal",
      wrestlerA: rowAt(finalLiveStandings, "Global League", 2)?.wrestler ?? null,
      wrestlerB: rowAt(finalLiveStandings, "Global League", 3)?.wrestler ?? null,
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
  return [...relegationMatches, ...eliteBase.map((match) => ({ ...match, id: buildFinalsMatchId(match) }))];
}

export function deriveLeagueFinalsFromFinalLiveStandings(input: LeagueFinalsInput): LeagueFinalsReview {
  const unresolvedTies = input.consequentialTies.filter((tie) => tie.status === "Tiebreaker Match Required");
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

  const canonicalRegistry = buildCanonicalLeagueFinalsRegistry(input.standings);
  const relegationMatches = canonicalRegistry.filter((match) => match.kind === "Relegation");
  const eliteCupQualifiers = input.standings
    .filter((row) => row.league === "Global League" && row.rank <= 4)
    .sort((a, b) => a.rank - b.rank);
  const eliteMatches = canonicalRegistry.filter((match) => match.kind !== "Relegation");
  const relegationValidationErrors = relegationMatches.flatMap(validateLeagueFinalsMatchSource);
  readinessReasons.push(...relegationValidationErrors);
  const finalStandingsErrors = validateFinalStandingsSource(input.standings, input.completedThroughWeek);
  const finalStandingsValid = finalStandingsErrors.length === 0 && completeStandings;
  const canRenderDerivedCards = finalStandingsValid && relegationValidationErrors.length === 0;
  const safeRelegationMatches = canRenderDerivedCards ? relegationMatches : [];
  const reviewRequired = [];
  reviewRequired.push("DQ encoding: current event result model does not safely identify the wrestler who caused a DQ.");
  reviewRequired.push("Manual card padding required if WWE 2K requires more matches; no filler is generated.");

  return {
    ready: readinessReasons.length === 0,
    readinessLabel: readinessReasons.length ? "Blocked" : "Ready",
    readinessReasons,
    champions,
    directMovements,
    relegationMatches: safeRelegationMatches,
    eliteCupQualifiers,
    nightOne: safeRelegationMatches.filter((match) => match.night === "Night One"),
    nightTwo: canRenderDerivedCards ? [...safeRelegationMatches.filter((match) => match.night === "Night Two"), ...eliteMatches] : [],
    reviewRequired,
    sourceAudit: buildSourceAudit(input.standings),
    finalStandingsValid,
    unresolvedTiebreakerCount: unresolvedTies.length,
    cardRenderability: {
      renderable: canRenderDerivedCards && safeRelegationMatches.filter((match) => match.night === "Night One").length === 6 && safeRelegationMatches.filter((match) => match.night === "Night Two").length + eliteMatches.length === 6,
      nightOneGeneratedCount: safeRelegationMatches.filter((match) => match.night === "Night One").length,
      nightTwoGeneratedCount: canRenderDerivedCards ? safeRelegationMatches.filter((match) => match.night === "Night Two").length + eliteMatches.length : 0,
      hiddenReasons: canRenderDerivedCards ? [] : [
        ...(!finalStandingsValid ? ["Final standings source is invalid or stale."] : []),
        ...(relegationValidationErrors.length ? relegationValidationErrors : []),
      ],
    },
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
  const semifinalWinners = results.filter((result) => (
    result.resultType === "Winner"
    && result.winner
    && (result.matchId === buildCanonicalLeagueFinalsMatchId("Night Two", 4) || result.matchId === buildCanonicalLeagueFinalsMatchId("Night Two", 5) || result.matchId.includes("night-two:elite-cup-semifinal"))
  ));
  return [
    semifinalWinners.find((result) => result.matchId === buildCanonicalLeagueFinalsMatchId("Night Two", 4) || result.matchId.includes(":4:"))?.winner ?? null,
    semifinalWinners.find((result) => result.matchId === buildCanonicalLeagueFinalsMatchId("Night Two", 5) || result.matchId.includes(":5:"))?.winner ?? null,
  ];
}

export function normalizeWrestlerNameForMatch(value: string | number | null | undefined): string {
  return `${value ?? ""}`
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^\s*winner\s*:\s*/i, "")
    .replace(/^\s*#\d+\s+/, "")
    .replace(/\s+(?:wins?|defeats?|advances?|retains?)\s*$/i, "")
    .replace(/^[\s:;,.#-]+|[\s:;,.#-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type ParsedLeagueFinalsSavedOutcome =
  | { type: "winner"; winner: string }
  | { type: "no-contest" }
  | { type: "invalid"; reason: string };

function selectedSideFromSavedResult(result: LeagueFinalsResult): "A" | "B" | null {
  const sideValue = result.winnerSide ?? result.selectedSide ?? result.participantSide ?? result.selectedParticipant ?? result.winnerIndex;
  const normalized = `${sideValue ?? ""}`.trim().toLowerCase();
  if (sideValue === 0 || normalized === "0" || normalized === "a" || normalized === "left" || normalized === "participant-a" || normalized === "wrestlera") return "A";
  if (sideValue === 1 || normalized === "1" || normalized === "b" || normalized === "right" || normalized === "participant-b" || normalized === "wrestlerb") return "B";
  return null;
}

function isNoContestValue(value: unknown): boolean {
  const normalized = `${value ?? ""}`.trim().replace(/[\s_-]+/g, "").toLowerCase();
  return normalized === "nocontest" || normalized === "nc" || normalized === "unclear";
}

function savedOutcomeCandidates(result: LeagueFinalsResult): unknown[] {
  return [result.winner, result.winnerName, result.selectedWinner, result.selectedResult, result.result, result.outcome, result.value, result.label, result.selection, result.resultType];
}

export function parseLeagueFinalsSavedOutcome(
  savedResult: LeagueFinalsResult,
  authoritativeMatch: LeagueFinalsMatch,
  allResults: LeagueFinalsResult[] = [],
): ParsedLeagueFinalsSavedOutcome {
  const [participantA, participantB] = resolveFinalsParticipants(authoritativeMatch, allResults);
  if (!participantA || !participantB) return { type: "invalid", reason: "participants are not yet resolved" };
  if (!["Winner", "No Contest"].includes(savedResult.resultType as string)) {
    return { type: "invalid", reason: "DQ/unsupported ending is ambiguous without caused-by-wrestler metadata" };
  }

  if (savedOutcomeCandidates(savedResult).some(isNoContestValue)) {
    return authoritativeMatch.kind === "Relegation"
      ? { type: "no-contest" }
      : { type: "invalid", reason: "No Contest fallback is only defined here for relegation matches" };
  }

  const side = selectedSideFromSavedResult(savedResult);
  if (side === "A") return { type: "winner", winner: participantA };
  if (side === "B") return { type: "winner", winner: participantB };

  const normalizedA = normalizeWrestlerNameForMatch(participantA);
  const normalizedB = normalizeWrestlerNameForMatch(participantB);
  for (const candidate of savedOutcomeCandidates(savedResult)) {
    const normalized = normalizeWrestlerNameForMatch(candidate as string | number | null | undefined);
    if (!normalized) continue;
    if (normalized === normalizedA) return { type: "winner", winner: participantA };
    if (normalized === normalizedB) return { type: "winner", winner: participantB };
  }
  return { type: "invalid", reason: "winner must be one of the derived participants" };
}

export function validateLeagueFinalsResult(
  result: LeagueFinalsResult,
  matches: LeagueFinalsMatch[],
  existingResults: LeagueFinalsResult[] = [],
): string[] {
  const match = matches.find((candidate) => candidate.id === result.matchId);
  if (!match || !match.authoritative) return [`${result.matchId}: League Finals match is not authoritative or confirmed.`];
  const parsed = parseLeagueFinalsSavedOutcome(result, match, existingResults);
  if (parsed.type === "invalid") return [`${result.matchId}: ${parsed.reason}.`];
  if (parsed.type === "no-contest" && result.winner !== null && result.winner !== undefined && !isNoContestValue(result.winner)) {
    return [`${result.matchId}: No Contest cannot have a winner.`];
  }
  return [];
}

export interface LeagueFinalsResultReconciliationDiagnostic {
  canonicalResultId: string;
  rawSavedWinner: string | null;
  rawSavedOutcome: string | null;
  savedMatchIdentity: string | null;
  savedLabel: string | null;
  savedParticipantSnapshot: unknown;
  authoritativeParticipantA: string | null;
  authoritativeParticipantB: string | null;
  registrySource: "shared-finals-helper" | "saved-match-identity-fallback";
  participantMismatchCausedByWrongRegistry: boolean;
  rawSavedObject: unknown;
  rawSavedSelectedOption: string | number | null;
  rawSavedResult: string | number | null;
  rawWinnerSide: string | number | null;
  rawSelectedSide: string | number | null;
  rawParticipantSide: string | number | null;
  rawWinnerIndex: number | null;
  normalizedWinner: string;
  repairedWinner: string | null;
  validationReason: string | null;
}

export interface LeagueFinalsResultsNormalization {
  results: LeagueFinalsResult[];
  migratedLegacyResultKeys: string[];
  unmatchedSavedResultKeys: string[];
  duplicateCanonicalResultIds: string[];
  canonicalMatchIds: string[];
  savedCanonicalResultIds: string[];
  repairedPayloads: string[];
  staleMetadataIgnoredKeys: string[];
  winnerReconciliationDiagnostics: LeagueFinalsResultReconciliationDiagnostic[];
  noContestAcceptedKeys: string[];
}

export function normalizeLeagueFinalsResults(
  matches: LeagueFinalsMatch[],
  results: LeagueFinalsResult[],
  registrySources: Map<string, "shared-finals-helper" | "saved-match-identity-fallback"> = new Map(),
): LeagueFinalsResultsNormalization {
  const canonicalMatchIds = matches.map((match) => match.id);
  const canonical = new Map(matches.map((match) => [match.id, match]));
  const legacyByIdentity = new Map<string, LeagueFinalsMatch>();
  for (const match of matches) {
    legacyByIdentity.set(buildLeagueFinalsMatchIdentity(match), match);
    legacyByIdentity.set(buildLeagueFinalsResultIdentity(match, results), match);
  }

  const normalized = new Map<string, LeagueFinalsResult>();
  const migratedLegacyResultKeys: string[] = [];
  const unmatchedSavedResultKeys: string[] = [];
  const duplicateCanonicalResultIds: string[] = [];
  const savedCanonicalResultIds: string[] = [];
  const repairedPayloads: string[] = [];
  const staleMetadataIgnoredKeys: string[] = [];
  const winnerReconciliationDiagnostics: LeagueFinalsResultReconciliationDiagnostic[] = [];
  const noContestAcceptedKeys: string[] = [];

  for (const result of results) {
    const direct = canonical.get(result.matchId);
    const legacy = direct ? null : legacyByIdentity.get(result.matchId);
    const match = direct ?? legacy;
    if (!match) {
      unmatchedSavedResultKeys.push(result.matchId);
      continue;
    }
    if (direct) savedCanonicalResultIds.push(result.matchId);
    if (legacy) migratedLegacyResultKeys.push(result.matchId);
    if (normalized.has(match.id)) duplicateCanonicalResultIds.push(match.id);

    const currentIdentity = buildLeagueFinalsResultIdentity(match, results);
    const hadStaleMetadata = Boolean(result.matchIdentity && result.matchIdentity !== currentIdentity);
    if (hadStaleMetadata) staleMetadataIgnoredKeys.push(result.matchId);
    if (legacy || hadStaleMetadata || result.matchId !== match.id || result.matchIdentity !== currentIdentity) {
      repairedPayloads.push(result.matchId);
    }
    const normalizedSoFar = [...normalized.values()];
    const allResultsForParticipants = [
      ...normalizedSoFar,
      ...results
        .filter((candidate) => !normalizedSoFar.some((saved) => saved.matchId === candidate.matchId))
        .map((candidate) => candidate.matchId === result.matchId ? { ...candidate, matchId: match.id } : candidate),
    ];
    const [participantA, participantB] = resolveFinalsParticipants(match, allResultsForParticipants);
    const parsedOutcome = parseLeagueFinalsSavedOutcome(result, match, allResultsForParticipants);
    const normalizedResultType: FinalsResultType = parsedOutcome.type === "no-contest" ? "No Contest" : "Winner";
    const repairedWinner = parsedOutcome.type === "winner" ? parsedOutcome.winner : null;
    const repairedOutcome = parsedOutcome.type === "invalid" ? null : parsedOutcome.type;
    if (parsedOutcome.type !== "invalid" && (result.resultType !== normalizedResultType || result.winner !== repairedWinner || result.outcome !== repairedOutcome)) repairedPayloads.push(match.id);
    if (parsedOutcome.type === "no-contest") noContestAcceptedKeys.push(match.id);
    winnerReconciliationDiagnostics.push({
      canonicalResultId: match.id,
      rawSavedWinner: result.winner,
      rawSavedOutcome: result.outcome ?? result.resultType,
      savedMatchIdentity: result.matchIdentity ?? null,
      savedLabel: result.label ?? null,
      savedParticipantSnapshot: result.participantSnapshot ?? null,
      authoritativeParticipantA: participantA,
      authoritativeParticipantB: participantB,
      registrySource: registrySources.get(match.id) ?? "shared-finals-helper",
      participantMismatchCausedByWrongRegistry: Boolean(
        result.matchIdentity
        && ![participantA, participantB].some((participant) => participant && result.matchIdentity?.includes(finalsIdentityPart(participant)))
        && parsedOutcome.type === "invalid"
        && parsedOutcome.reason === "winner must be one of the derived participants"
      ),
      rawSavedObject: result,
      rawSavedSelectedOption: result.selectedResult ?? result.selectedWinner ?? result.selection ?? result.value ?? null,
      rawSavedResult: result.result ?? result.resultType ?? null,
      rawWinnerSide: result.winnerSide ?? null,
      rawSelectedSide: result.selectedSide ?? null,
      rawParticipantSide: result.participantSide ?? null,
      rawWinnerIndex: result.winnerIndex ?? null,
      normalizedWinner: normalizeWrestlerNameForMatch(result.winner ?? result.winnerName ?? result.selectedWinner ?? result.selectedResult ?? result.result ?? result.outcome ?? result.value ?? result.label ?? result.selection),
      repairedWinner,
      validationReason: parsedOutcome.type === "invalid" ? parsedOutcome.reason : null,
    });
    normalized.set(match.id, {
      ...result,
      matchId: match.id,
      resultType: parsedOutcome.type === "invalid" ? result.resultType : normalizedResultType,
      winner: parsedOutcome.type === "invalid" ? result.winner : repairedWinner,
      outcome: parsedOutcome.type === "invalid" ? result.outcome : repairedOutcome,
      matchIdentity: currentIdentity,
    });
  }

  return {
    results: [...normalized.values()],
    migratedLegacyResultKeys,
    unmatchedSavedResultKeys,
    duplicateCanonicalResultIds: [...new Set(duplicateCanonicalResultIds)],
    canonicalMatchIds,
    savedCanonicalResultIds,
    repairedPayloads: [...new Set(repairedPayloads)],
    staleMetadataIgnoredKeys,
    winnerReconciliationDiagnostics,
    noContestAcceptedKeys: [...new Set(noContestAcceptedKeys)],
  };
}

export function sanitizeLeagueFinalsResults(
  matches: LeagueFinalsMatch[],
  results: LeagueFinalsResult[],
): LeagueFinalsResult[] {
  const normalized = normalizeLeagueFinalsResults(matches, results).results;
  const sanitized: LeagueFinalsResult[] = [];
  for (const result of normalized) {
    const match = matches.find((candidate) => candidate.id === result.matchId);
    if (!match) continue;
    const participantResults = [...sanitized, ...normalized.filter((candidate) => candidate.matchId !== result.matchId)];
    if (validateLeagueFinalsResult(result, matches, participantResults).length) continue;
    if (!result.matchIdentity && result.resultType === "Winner") {
      const participants = resolveFinalsParticipants(match, participantResults);
      if (!participants.includes(result.winner)) continue;
    }
    sanitized.push(result.matchIdentity ? result : { ...result, matchIdentity: buildLeagueFinalsResultIdentity(match, participantResults) });
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
