import { LEAGUE_NAMES, type LeagueName } from "./types";

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
}

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

function duplicateNames(names: string[]): string[] {
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

export function validateNewRunSetupDraft(draft: NewRunSetupDraft): NewRunValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cawDuplicates = duplicateNames(draft.caws);
  if (cawDuplicates.length) errors.push(`Duplicate CAWs are not allowed: ${cawDuplicates.join(", ")}.`);

  if (draft.rosterMode === "automatic") {
    warnings.push("Automatic roster generation is not ready for activation in Phase 14A.");
    return { valid: false, readyForActivation: false, errors, warnings };
  }

  if (draft.rosterMode !== "manual") {
    errors.push("Choose Manual or Automatic roster assignment before preview can be valid.");
    return { valid: false, readyForActivation: false, errors, warnings };
  }

  if (LEAGUE_NAMES.length !== 4) errors.push(`Manual setup expected exactly 4 leagues; found ${LEAGUE_NAMES.length}.`);
  for (const league of LEAGUE_NAMES) {
    const slots = draft.manualRoster[league] ?? [];
    if (slots.length !== 12) errors.push(`${league} must have exactly 12 seed slots.`);
    slots.forEach((slot, index) => {
      if (!normalizeSetupName(slot)) errors.push(`${league} Seed ${index + 1} must be filled before preview can be valid.`);
    });
  }

  const slots = flattenManualRoster(draft.manualRoster);
  const filledNames = slots.map((slot) => normalizeSetupName(slot.wrestler)).filter(Boolean);
  if (filledNames.length !== 48) errors.push(`Manual active roster must contain exactly 48 filled wrestlers; found ${filledNames.length}.`);
  const wrestlerDuplicates = duplicateNames(filledNames);
  if (wrestlerDuplicates.length) errors.push(`Duplicate active wrestlers are not allowed: ${wrestlerDuplicates.join(", ")}.`);

  const cawKeys = new Set(draft.caws.map((caw) => normalizeSetupName(caw).toLocaleLowerCase()).filter(Boolean));
  const cawManualConflicts = filledNames.filter((name) => cawKeys.has(name.toLocaleLowerCase()));
  if (new Set(cawManualConflicts.map((name) => name.toLocaleLowerCase())).size !== draft.caws.length) {
    warnings.push("Entered CAWs can be placed manually like normal wrestlers; unplaced CAWs will not be active in this draft.");
  }

  return { valid: errors.length === 0, readyForActivation: false, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
