import { HIDDEN_MALE_WRESTLER_POOL, validateWrestlerPool, type WrestlerPoolEntry } from "@/data/wrestlerPool";
import { generateSchedule, validateSchedule, createAcceptedScheduleSnapshot } from "./schedule-setup";
import type { TrackerState } from "./tracker-state";
import { LEAGUE_NAMES, type LeagueName, type StandingRow } from "./types";

export type NewRunBackupChoice = "created" | "skipped" | "not-available" | null;
export type NewRunRosterMode = "manual" | "automatic" | null;

export interface ManualSeedSlot {
  league: LeagueName;
  seed: number;
  wrestler: string;
}

export interface NewRunSetupDraft {
  backupChoice: NewRunBackupChoice;
  caws: string[];
  rosterMode: NewRunRosterMode;
  manualRoster: Record<LeagueName, string[]>;
}

export interface NewRunValidationResult {
  valid: boolean;
  readyForActivation: boolean;
  errors: string[];
  warnings: string[];
  summary: AutomaticRosterValidationSummary;
}

export interface AutomaticRosterValidationSummary {
  rosterCount: number;
  requiredRosterCount: number;
  leagueCounts: Record<LeagueName, number>;
  requiredLeagueCount: number;
  duplicates: number;
  cawsIncluded: number;
  cawsEntered: number;
}

export const AUTOMATIC_ROSTER_SIZE = 48;
export const LEAGUE_ROSTER_SIZE = 12;

export const NEW_RUN_START_BASIS = {
  leagueYear: 1,
  split: "Opening Split",
  week: 1,
} as const;

export function createEmptyNewRunSetupDraft(): NewRunSetupDraft {
  return {
    backupChoice: null,
    caws: [],
    rosterMode: null,
    manualRoster: createEmptyManualRoster(),
  };
}

export function createEmptyManualRoster(): Record<LeagueName, string[]> {
  return LEAGUE_NAMES.reduce((roster, league) => ({ ...roster, [league]: Array.from({ length: 12 }, () => "") }), {} as Record<LeagueName, string[]>);
}

export function normalizeSetupName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function duplicateSetupNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const raw of names) {
    const normalized = normalizeSetupName(raw);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) duplicates.add(normalized);
    else seen.set(key, normalized);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

export function validateCawName(name: string, existingCaws: string[], manualNames: string[] = []): string[] {
  const normalized = normalizeSetupName(name);
  const errors: string[] = [];
  if (!normalized) errors.push("CAW name cannot be empty.");
  const key = normalized.toLocaleLowerCase();
  if (existingCaws.some((caw) => normalizeSetupName(caw).toLocaleLowerCase() === key)) errors.push(`${normalized || "CAW"} is already in the CAW list.`);
  if (manualNames.some((manual) => normalizeSetupName(manual).toLocaleLowerCase() === key)) errors.push(`${normalized || "CAW"} already appears in the manual roster.`);
  return errors;
}

export function addCawToDraft(draft: NewRunSetupDraft, name: string): { draft: NewRunSetupDraft; errors: string[] } {
  const manualNames = flattenManualRoster(draft.manualRoster).map((slot) => slot.wrestler);
  const errors = validateCawName(name, draft.caws, manualNames);
  if (errors.length) return { draft, errors };
  return { draft: { ...draft, caws: [...draft.caws, normalizeSetupName(name)] }, errors: [] };
}

export function flattenManualRoster(manualRoster: Record<LeagueName, string[]>): ManualSeedSlot[] {
  return LEAGUE_NAMES.flatMap((league) => (manualRoster[league] ?? []).map((wrestler, index) => ({ league, seed: index + 1, wrestler })));
}


function cawPoolConflicts(caws: string[], pool: WrestlerPoolEntry[] = HIDDEN_MALE_WRESTLER_POOL): string[] {
  const poolKeys = new Set(pool.map((entry) => normalizeSetupName(entry.name).toLocaleLowerCase()).filter(Boolean));
  return caws.map(normalizeSetupName).filter((caw) => caw && poolKeys.has(caw.toLocaleLowerCase()));
}

function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function generateAutomaticRosterDraft(
  draft: NewRunSetupDraft,
  options: { pool?: WrestlerPoolEntry[]; random?: () => number } = {},
): { draft: NewRunSetupDraft; errors: string[] } {
  const pool = options.pool ?? HIDDEN_MALE_WRESTLER_POOL;
  const poolErrors = validateWrestlerPool(pool);
  const normalizedCaws = draft.caws.map(normalizeSetupName).filter(Boolean);
  const cawDuplicates = duplicateSetupNames(normalizedCaws);
  const conflicts = cawPoolConflicts(normalizedCaws, pool);
  const errors = [...poolErrors];
  if (cawDuplicates.length) errors.push(`Duplicate CAWs are not allowed: ${cawDuplicates.join(", ")}.`);
  if (conflicts.length) errors.push(`CAWs must not duplicate hidden pool wrestlers: ${[...new Set(conflicts)].join(", ")}.`);
  if (normalizedCaws.length > AUTOMATIC_ROSTER_SIZE) errors.push(`Automatic roster generation supports at most ${AUTOMATIC_ROSTER_SIZE} CAWs.`);
  const neededPoolNames = AUTOMATIC_ROSTER_SIZE - normalizedCaws.length;
  const uniquePoolNames = [...new Map(pool.map((entry) => [normalizeSetupName(entry.name).toLocaleLowerCase(), normalizeSetupName(entry.name)] as const).filter(([key]) => Boolean(key))).values()];
  if (uniquePoolNames.length < neededPoolNames) errors.push("Not enough wrestlers in the hidden pool for automatic roster generation.");
  if (errors.length) return { draft: { ...draft, rosterMode: "automatic" }, errors: [...new Set(errors)] };

  const selectedPoolNames = shuffle(uniquePoolNames, options.random).slice(0, neededPoolNames);
  const randomizedRoster = shuffle([...normalizedCaws, ...selectedPoolNames], options.random);
  const manualRoster = LEAGUE_NAMES.reduce((roster, league, leagueIndex) => {
    roster[league] = randomizedRoster.slice(leagueIndex * LEAGUE_ROSTER_SIZE, (leagueIndex + 1) * LEAGUE_ROSTER_SIZE);
    return roster;
  }, {} as Record<LeagueName, string[]>);
  return { draft: { ...draft, rosterMode: "automatic", caws: normalizedCaws, manualRoster }, errors: [] };
}
export function createRosterValidationSummary(draft: NewRunSetupDraft): AutomaticRosterValidationSummary {
  const names = LEAGUE_NAMES.flatMap((league) => (draft.manualRoster[league] ?? []).map(normalizeSetupName).filter(Boolean));
  const lowerNames = names.map((name) => name.toLocaleLowerCase());
  const duplicateKeys = lowerNames.filter((name, index) => lowerNames.indexOf(name) !== index);
  const cawKeys = new Set(draft.caws.map((caw) => normalizeSetupName(caw).toLocaleLowerCase()).filter(Boolean));
  const activeKeys = new Set(lowerNames);
  return {
    rosterCount: names.length,
    requiredRosterCount: AUTOMATIC_ROSTER_SIZE,
    leagueCounts: LEAGUE_NAMES.reduce((counts, league) => {
      counts[league] = (draft.manualRoster[league] ?? []).map(normalizeSetupName).filter(Boolean).length;
      return counts;
    }, {} as Record<LeagueName, number>),
    requiredLeagueCount: LEAGUE_ROSTER_SIZE,
    duplicates: new Set(duplicateKeys).size,
    cawsIncluded: [...cawKeys].filter((key) => activeKeys.has(key)).length,
    cawsEntered: cawKeys.size,
  };
}

export function validateNewRunSetupDraft(draft: NewRunSetupDraft): NewRunValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary = createRosterValidationSummary(draft);
  const cawDuplicates = duplicateSetupNames(draft.caws);
  if (cawDuplicates.length) errors.push(`Duplicate CAWs are not allowed: ${cawDuplicates.join(", ")}.`);

  if (draft.rosterMode === "automatic") {
    errors.push(...validateWrestlerPool());
    const conflicts = cawPoolConflicts(draft.caws);
    if (conflicts.length) errors.push(`CAWs must not duplicate hidden pool wrestlers: ${[...new Set(conflicts)].join(", ")}.`);
    const neededPoolNames = AUTOMATIC_ROSTER_SIZE - draft.caws.map(normalizeSetupName).filter(Boolean).length;
    const uniquePoolNames = new Set(HIDDEN_MALE_WRESTLER_POOL.map((entry) => normalizeSetupName(entry.name).toLocaleLowerCase()).filter(Boolean));
    if (neededPoolNames < 0 || uniquePoolNames.size < neededPoolNames) errors.push("Not enough wrestlers in the hidden pool for automatic roster generation.");
  }

  if (draft.rosterMode !== "manual" && draft.rosterMode !== "automatic") {
    errors.push("Choose Manual or Automatic roster assignment before preview can be valid.");
    return { valid: false, readyForActivation: false, errors, warnings, summary };
  }

  if (LEAGUE_NAMES.length !== 4) errors.push(`Roster setup expected exactly 4 leagues; found ${LEAGUE_NAMES.length}.`);
  for (const league of LEAGUE_NAMES) {
    const slots = draft.manualRoster[league] ?? [];
    if (slots.length !== 12) errors.push(`${league} must have exactly 12 seed slots.`);
    slots.forEach((slot, index) => {
      if (!normalizeSetupName(slot)) errors.push(`${league} Seed ${index + 1} must be filled before preview can be valid.`);
    });
  }

  const slots = flattenManualRoster(draft.manualRoster);
  const filledNames = slots.map((slot) => normalizeSetupName(slot.wrestler)).filter(Boolean);
  if (filledNames.length !== 48) errors.push(`Active roster must contain exactly 48 filled wrestlers; found ${filledNames.length}.`);
  const wrestlerDuplicates = duplicateSetupNames(filledNames);
  if (wrestlerDuplicates.length) errors.push(`Duplicate active wrestlers are not allowed: ${wrestlerDuplicates.join(", ")}.`);

  const cawKeys = new Set(draft.caws.map((caw) => normalizeSetupName(caw).toLocaleLowerCase()).filter(Boolean));
  const cawManualConflicts = filledNames.filter((name) => cawKeys.has(name.toLocaleLowerCase()));
  const includedCawCount = new Set(cawManualConflicts.map((name) => name.toLocaleLowerCase())).size;
  if (includedCawCount !== cawKeys.size) {
    const message = "Entered CAWs can be placed manually like normal wrestlers; unplaced CAWs will not be active in this draft.";
    if (draft.rosterMode === "automatic") errors.push("Automatic roster must include every entered CAW.");
    else warnings.push(message);
  }

  return { valid: errors.length === 0, readyForActivation: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], summary };
}


export interface FreshRunActivationResult {
  ok: boolean;
  state: TrackerState;
  errors: string[];
}

function manualSeeds(draft: NewRunSetupDraft) {
  return LEAGUE_NAMES.reduce((seeds, league) => {
    seeds[league] = draft.manualRoster[league].map((name, index) => ({ seed: index + 1, wrestler: normalizeSetupName(name) }));
    return seeds;
  }, {} as Record<LeagueName, { seed: number; wrestler: string }[]>);
}

function zeroStandingsFromDraft(draft: NewRunSetupDraft): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => draft.manualRoster[league].map((name, index) => ({
    league,
    rank: index + 1,
    wrestler: normalizeSetupName(name),
    seed: index + 1,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: "fresh run seed",
  })));
}

function chooseCurrentUser(standings: StandingRow[], caws: string[]): string {
  const byName = new Map(standings.map((row) => [normalizeSetupName(row.wrestler).toLocaleLowerCase(), row.wrestler]));
  return byName.get("beckielo")
    ?? caws.map((caw) => byName.get(normalizeSetupName(caw).toLocaleLowerCase())).find((name): name is string => Boolean(name))
    ?? standings[0]?.wrestler
    ?? "";
}

export function validateFreshRunState(state: TrackerState, standings: StandingRow[]): string[] {
  const errors: string[] = [];
  const accepted = state.acceptedSchedule;
  const rosterNames = standings.map((row) => row.wrestler);
  const rosterKeys = new Set(rosterNames.map((name) => normalizeSetupName(name).toLocaleLowerCase()));
  if (standings.length !== 48) errors.push(`Active roster count is ${standings.length}; expected 48.`);
  if (rosterKeys.size !== standings.length) errors.push("Active roster contains duplicate wrestler names.");
  for (const league of LEAGUE_NAMES) if (standings.filter((row) => row.league === league).length !== 12) errors.push(`${league} must have exactly 12 wrestlers.`);
  if (!state.currentUserWrestler || !rosterKeys.has(normalizeSetupName(state.currentUserWrestler).toLocaleLowerCase())) errors.push("Current User must exist in the active roster.");
  if (state.confirmedResults.length) errors.push("Fresh run must not retain active completed results.");
  if (state.completedWeeks.length) errors.push("Fresh run must not retain completed week locks.");
  if (!accepted?.validation.valid) errors.push("Fresh run schedule must be a valid accepted schedule.");
  if (accepted) {
    for (const match of accepted.matches) {
      if (!rosterKeys.has(normalizeSetupName(match.wrestlerA).toLocaleLowerCase()) || !rosterKeys.has(normalizeSetupName(match.wrestlerB).toLocaleLowerCase())) errors.push(`${match.id}: schedule references a wrestler outside the active roster.`);
    }
  }
  for (const row of standings) if (row.matches || row.wins || row.draws || row.losses || row.points) errors.push(`${row.wrestler}: fresh run standings must start at 0.`);
  return [...new Set(errors)];
}

export function activateFreshRunSetup(state: TrackerState, draft: NewRunSetupDraft, activatedAt = new Date().toISOString()): FreshRunActivationResult {
  const validation = validateNewRunSetupDraft(draft);
  if (!validation.valid || !validation.readyForActivation) return { ok: false, state, errors: [...validation.errors, ...validation.warnings] };
  const seeds = manualSeeds(draft);
  const rosters = LEAGUE_NAMES.reduce((acc, league) => ({ ...acc, [league]: seeds[league].map((seed) => seed.wrestler) }), {} as Record<LeagueName, string[]>);
  const preview = generateSchedule({ leagueYear: NEW_RUN_START_BASIS.leagueYear, split: NEW_RUN_START_BASIS.split, yearWeekStart: NEW_RUN_START_BASIS.week, seeds, generatedAt: activatedAt });
  const scheduleValidation = validateSchedule(preview, { rosters });
  if (!scheduleValidation.valid) return { ok: false, state, errors: scheduleValidation.errors };
  const acceptedSchedule = createAcceptedScheduleSnapshot({ preview, validation: scheduleValidation, acceptedAt: activatedAt, leagueYear: NEW_RUN_START_BASIS.leagueYear, split: NEW_RUN_START_BASIS.split });
  const standings = zeroStandingsFromDraft(draft);
  const currentUserWrestler = chooseCurrentUser(standings, draft.caws);
  const nextState: TrackerState = {
    ...state,
    confirmedResults: [],
    completedWeeks: [],
    leagueFinalsResults: [],
    completedFinalsNights: [],
    acceptedSchedule,
    activeWorkflow: {
      leagueYear: NEW_RUN_START_BASIS.leagueYear,
      split: NEW_RUN_START_BASIS.split,
      yearWeek: NEW_RUN_START_BASIS.week,
      splitWeek: 1,
      scheduleSource: "accepted generated snapshot",
      acceptedScheduleAt: acceptedSchedule.acceptedAt,
      activatedAt,
      userLeague: standings.find((row) => row.wrestler === currentUserWrestler)?.league ?? "Global League",
    },
    manualReviews: [],
    currentUserWrestler,
    rosterReplacements: [],
    newRunSetupDraft: undefined,
  };
  const finalErrors = validateFreshRunState(nextState, standings);
  if (finalErrors.length) return { ok: false, state, errors: finalErrors };
  return { ok: true, state: nextState, errors: [] };
}
