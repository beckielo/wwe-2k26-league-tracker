import { LEAGUE_NAMES, type LeagueName, type SplitName } from "./types";

export const SCHEDULE_GENERATOR_VERSION = "1.0.0";
export const SCHEDULE_IMPORTER_VERSION = "1.0.0";

export interface ScheduleSeed { seed: number; wrestler: string }
export interface GeneratedScheduleMatch {
  id: string; leagueYear: number; split: SplitName; splitWeek: number; yearWeek?: number;
  league: LeagueName; wrestlerA: string; wrestlerB: string; seedA: number; seedB: number;
  leg: "Hinrunde" | "Rückrunde"; source: "Generated" | "Imported";
  generatedAt: string; generatorVersion?: string; importerVersion?: string; validationStatus: "Preview" | "Valid" | "Review Required";
}
export interface ScheduleSetupInput {
  leagueYear: number; split: SplitName; seeds: Record<LeagueName, ScheduleSeed[]>;
  yearWeekStart?: number; generatedAt?: string;
}
export interface ScheduleValidationContext {
  rosters: Record<LeagueName, string[]>; lockedYearWeeks?: number[];
}
export interface ScheduleValidation { valid: boolean; status: "Valid" | "Review Required"; errors: string[]; warnings: string[]; totalMatches: number }
export interface AcceptedScheduleSnapshot {
  matches: GeneratedScheduleMatch[]; acceptedAt: string; acceptedBy: "local user workflow";
  generatorVersion?: string; importerVersion?: string; source: "Generated" | "Imported";
  leagueYear: number; split: SplitName; seedSource: string; rosterSource: string; validation: ScheduleValidation;
}

export interface ScheduleAcceptanceInput {
  transitionReady: boolean;
  seedsReady: boolean;
  preview: GeneratedScheduleMatch[];
  validation: ScheduleValidation;
  hasBlockingManualReview: boolean;
  hasAcceptedSnapshot: boolean;
  replaceConfirmed: boolean;
}

export interface ScheduleAcceptanceStatus {
  enabled: boolean;
  disabledReason: string | null;
}

const slug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pairKey = (a: string, b: string) => [a, b].sort().join("::");

export function createSeedSlotTemplate(): Array<Array<[number, number]>> {
  let slots = Array.from({ length: 12 }, (_, index) => index + 1);
  const rounds: Array<Array<[number, number]>> = [];
  for (let round = 0; round < 11; round += 1) {
    rounds.push(Array.from({ length: 6 }, (_, index) => [slots[index], slots[11 - index]] as [number, number]));
    slots = [slots[0], slots[11], ...slots.slice(1, 11)];
  }
  return rounds;
}

export function generateSchedule(input: ScheduleSetupInput): GeneratedScheduleMatch[] {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const template = createSeedSlotTemplate();
  return LEAGUE_NAMES.flatMap((league) => {
    const bySeed = new Map(input.seeds[league].map((entry) => [entry.seed, entry.wrestler]));
    return Array.from({ length: 22 }, (_, weekIndex) => {
      const returning = weekIndex >= 11;
      const splitWeek = weekIndex + 1;
      return template[weekIndex % 11].map(([first, second], matchIndex) => {
        const seedA = returning ? second : first;
        const seedB = returning ? first : second;
        return {
          id: `schedule-y${input.leagueYear}-${slug(input.split)}-${slug(league)}-w${String(splitWeek).padStart(2, "0")}-m${matchIndex + 1}`,
          leagueYear: input.leagueYear, split: input.split, splitWeek,
          ...(input.yearWeekStart === undefined ? {} : { yearWeek: input.yearWeekStart + weekIndex }),
          league, wrestlerA: bySeed.get(seedA) ?? "", wrestlerB: bySeed.get(seedB) ?? "", seedA, seedB,
          leg: returning ? "Rückrunde" as const : "Hinrunde" as const, source: "Generated" as const,
          generatedAt, generatorVersion: SCHEDULE_GENERATOR_VERSION, validationStatus: "Preview" as const,
        };
      });
    }).flat();
  });
}

export function validateSchedule(matches: GeneratedScheduleMatch[], context: ScheduleValidationContext): ScheduleValidation {
  const errors: string[] = [];
  const ids = matches.map((match) => match.id);
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) errors.push(`Duplicate match ID: ${id}.`);
  if (matches.length !== 528) errors.push(`Schedule has ${matches.length} matches; expected 528.`);
  const presentLeagues = new Set(matches.map((match) => match.league));
  if (presentLeagues.size !== 4 || LEAGUE_NAMES.some((league) => !presentLeagues.has(league))) errors.push("Schedule must contain exactly the four authoritative leagues.");

  for (const league of LEAGUE_NAMES) {
    const rosterList = context.rosters[league];
    const roster = new Set(rosterList);
    if (roster.size !== 12 || rosterList.length !== 12) errors.push(`${league} roster must contain exactly 12 unique wrestlers.`);
    const leagueMatches = matches.filter((match) => match.league === league);
    if (leagueMatches.length !== 132) errors.push(`${league} has ${leagueMatches.length} matches; expected 132.`);
    const weeks = new Set(leagueMatches.map((match) => match.splitWeek));
    if (weeks.size !== 22 || Array.from({ length: 22 }, (_, i) => i + 1).some((week) => !weeks.has(week))) errors.push(`${league} must contain Weeks 1–22 exactly.`);
    const totalPairs = new Map<string, number>();
    const firstPairs = new Map<string, number>();
    const returnPairs = new Map<string, number>();
    const appearances = new Map<string, number>();
    for (const match of leagueMatches) {
      if (!roster.has(match.wrestlerA) || !roster.has(match.wrestlerB)) errors.push(`${match.id}: unknown wrestler for ${league}.`);
      if (match.wrestlerA === match.wrestlerB) errors.push(`${match.id}: self-match is invalid.`);
      if (context.lockedYearWeeks?.includes(match.yearWeek ?? -1)) errors.push(`${match.id}: overlaps already-played locked Year Week ${match.yearWeek}.`);
      const key = pairKey(match.wrestlerA, match.wrestlerB);
      totalPairs.set(key, (totalPairs.get(key) ?? 0) + 1);
      const legPairs = match.splitWeek <= 11 ? firstPairs : returnPairs;
      legPairs.set(key, (legPairs.get(key) ?? 0) + 1);
      appearances.set(match.wrestlerA, (appearances.get(match.wrestlerA) ?? 0) + 1);
      appearances.set(match.wrestlerB, (appearances.get(match.wrestlerB) ?? 0) + 1);
    }
    for (let week = 1; week <= 22; week += 1) {
      const rows = leagueMatches.filter((match) => match.splitWeek === week);
      if (rows.length !== 6) errors.push(`${league} Week ${week} has ${rows.length} matches; expected 6.`);
      const names = rows.flatMap((match) => [match.wrestlerA, match.wrestlerB]);
      if (names.length !== 12 || new Set(names).size !== 12) errors.push(`${league} Week ${week} schedules a wrestler more than once or omits a wrestler.`);
    }
    for (const wrestler of roster) if ((appearances.get(wrestler) ?? 0) !== 22) errors.push(`${league}: ${wrestler} has ${appearances.get(wrestler) ?? 0} matches; expected 22.`);
    if (totalPairs.size !== 66) errors.push(`${league} has ${totalPairs.size} unique pairings; expected 66.`);
    for (const [key, count] of totalPairs) if (count !== 2 || firstPairs.get(key) !== 1 || returnPairs.get(key) !== 1) errors.push(`${league}: ${key.replace("::", " vs ")} must occur once in each leg.`);
  }
  return { valid: errors.length === 0, status: errors.length ? "Review Required" : "Valid", errors: [...new Set(errors)], warnings: [], totalMatches: matches.length };
}

export function importScheduleJson(json: string, context: ScheduleValidationContext): { matches: GeneratedScheduleMatch[]; validation: ScheduleValidation } {
  let value: unknown;
  try { value = JSON.parse(json); } catch { return { matches: [], validation: { valid: false, status: "Review Required", errors: ["Import is not valid JSON."], warnings: [], totalMatches: 0 } }; }
  const rows = Array.isArray(value) ? value : (value && typeof value === "object" && Array.isArray((value as { matches?: unknown }).matches) ? (value as { matches: unknown[] }).matches : []);
  const leagueLookup = new Map(LEAGUE_NAMES.map((league) => [league.toLowerCase(), league]));
  const nameLookup = new Map(LEAGUE_NAMES.flatMap((league) => context.rosters[league].map((name) => [`${league}:${name.toLowerCase()}`, name] as const)));
  const matches = rows.map((raw) => {
    const row = raw as Partial<GeneratedScheduleMatch>;
    const league = leagueLookup.get(String(row.league ?? "").trim().toLowerCase()) ?? row.league as LeagueName;
    return { ...row, league, wrestlerA: nameLookup.get(`${league}:${String(row.wrestlerA ?? "").trim().toLowerCase()}`) ?? String(row.wrestlerA ?? "").trim(), wrestlerB: nameLookup.get(`${league}:${String(row.wrestlerB ?? "").trim().toLowerCase()}`) ?? String(row.wrestlerB ?? "").trim(), source: "Imported", importerVersion: row.importerVersion ?? SCHEDULE_IMPORTER_VERSION } as GeneratedScheduleMatch;
  });
  return { matches, validation: validateSchedule(matches, context) };
}

export function getScheduleAcceptanceStatus(input: ScheduleAcceptanceInput): ScheduleAcceptanceStatus {
  if (!input.transitionReady) return { enabled: false, disabledReason: "Phase 9B Transition must be ready." };
  if (!input.seedsReady) return { enabled: false, disabledReason: "Phase 9.5 Seeds must be ready." };
  if (input.preview.length === 0) return { enabled: false, disabledReason: "Generate or import a valid schedule preview first." };
  if (!input.validation.valid || input.validation.totalMatches !== 528) return { enabled: false, disabledReason: "Validation must be valid before acceptance." };
  if (input.hasBlockingManualReview) return { enabled: false, disabledReason: "Resolve blocking Manual Review items first." };
  if (input.hasAcceptedSnapshot && !input.replaceConfirmed) return { enabled: false, disabledReason: "Existing accepted snapshot present — check replace box to overwrite." };
  return { enabled: true, disabledReason: null };
}

export function createAcceptedScheduleSnapshot(input: {
  preview: GeneratedScheduleMatch[];
  validation: ScheduleValidation;
  acceptedAt?: string;
  leagueYear: number;
  split: SplitName;
}): AcceptedScheduleSnapshot {
  const source = input.preview[0]?.source ?? "Generated";
  return {
    matches: input.preview.map((match) => ({ ...match, validationStatus: "Valid" })),
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    acceptedBy: "local user workflow",
    source,
    leagueYear: input.leagueYear,
    split: input.split,
    seedSource: "Phase 9.5 continuity seeds",
    rosterSource: "Phase 9B post-finals composition",
    generatorVersion: source === "Generated" ? input.preview[0]?.generatorVersion : undefined,
    importerVersion: source === "Imported" ? input.preview[0]?.importerVersion : undefined,
    validation: input.validation,
  };
}

export function canActivateNextWeek(input: { transitionValid: boolean; seedsValid: boolean; acceptedSchedule?: AcceptedScheduleSnapshot; target: "Closing Split Week 1" | "New League Year Week 1"; hasOpenManualReviews?: boolean }): boolean {
  return !input.hasOpenManualReviews && input.transitionValid && input.seedsValid && Boolean(input.acceptedSchedule?.validation.valid)
    && (input.target === "Closing Split Week 1" ? input.acceptedSchedule?.split === "Closing Split" : input.acceptedSchedule?.split === "Opening Split");
}
