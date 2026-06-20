import { LEAGUE_NAMES, type LeagueName, type StandingRow } from "./types";

export interface CurrentUserOption {
  wrestler: string;
  league: LeagueName;
}

const DEFAULT_CURRENT_USER = "Beckielo";

export function getActiveCurrentUserOptions(standings: StandingRow[]): CurrentUserOption[] {
  const seen = new Set<string>();
  return standings
    .filter((row) => row.rank >= 1 && row.rank <= 12)
    .sort((a, b) => LEAGUE_NAMES.indexOf(a.league) - LEAGUE_NAMES.indexOf(b.league) || a.rank - b.rank || a.wrestler.localeCompare(b.wrestler))
    .reduce<CurrentUserOption[]>((options, row) => {
      const key = row.wrestler.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return options;
      seen.add(key);
      options.push({ wrestler: row.wrestler, league: row.league });
      return options;
    }, []);
}

export function resolveCurrentUser(standings: StandingRow[], storedWrestler?: string | null): CurrentUserOption | null {
  const options = getActiveCurrentUserOptions(standings);
  const findByName = (name: string) => options.find((option) => option.wrestler.toLocaleLowerCase() === name.toLocaleLowerCase()) ?? null;
  if (storedWrestler) {
    const stored = findByName(storedWrestler);
    if (stored) return stored;
  }
  return findByName(DEFAULT_CURRENT_USER) ?? options[0] ?? null;
}
