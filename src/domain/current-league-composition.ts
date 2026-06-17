import { calculatePoints } from "./scoring";
import { LEAGUE_NAMES, type League, type LeagueName, type Match, type MatchResult, type SplitName, type StandingRow, type ValidationIssue } from "./types";

function key(name: string): string { return name.trim().toLocaleLowerCase(); }

export function buildCurrentStandingsFromScheduleComposition(
  sourceStandings: StandingRow[],
  matches: Match[],
  results: MatchResult[],
  split: SplitName,
): StandingRow[] | null {
  const splitMatches = matches.filter((match) => match.split === split);
  if (!splitMatches.length) return null;
  const byLeague = new Map<LeagueName, string[]>();
  for (const league of LEAGUE_NAMES) byLeague.set(league, []);
  for (const match of splitMatches) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const roster = byLeague.get(match.league)!;
      if (!roster.some((name) => key(name) === key(wrestler))) roster.push(wrestler);
    }
  }
  if (LEAGUE_NAMES.some((league) => (byLeague.get(league)?.length ?? 0) !== 12)) return null;
  const all = LEAGUE_NAMES.flatMap((league) => byLeague.get(league)!);
  if (new Set(all.map(key)).size !== 48) return null;

  const sourceByName = new Map(sourceStandings.map((row) => [key(row.wrestler), row]));
  const rows = LEAGUE_NAMES.flatMap((league) => byLeague.get(league)!.map((wrestler, index): StandingRow => {
    const source = sourceByName.get(key(wrestler));
    return {
      league,
      rank: index + 1,
      wrestler,
      seed: source?.seed ?? index + 1,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      status: source?.status ? `${source.status} · current composition` : "current composition",
    };
  }));

  const rowByKey = new Map(rows.map((row) => [`${row.league}:${key(row.wrestler)}`, row]));
  const matchById = new Map(splitMatches.map((match) => [match.id, match]));
  for (const result of results) {
    const match = matchById.get(result.matchId);
    if (!match || result.outcome === "no-contest" || result.outcome === "unclear") continue;
    const rowA = rowByKey.get(`${match.league}:${key(match.wrestlerA)}`);
    const rowB = rowByKey.get(`${match.league}:${key(match.wrestlerB)}`);
    if (!rowA || !rowB) continue;
    rowA.matches += 1;
    rowB.matches += 1;
    if (result.outcome === "draw") {
      rowA.draws += 1;
      rowB.draws += 1;
    } else if (result.winner) {
      const winner = key(result.winner) === key(match.wrestlerA) ? rowA : rowB;
      const loser = winner === rowA ? rowB : rowA;
      winner.wins += 1;
      loser.losses += 1;
    }
    rowA.points = calculatePoints(rowA.wins, rowA.draws);
    rowB.points = calculatePoints(rowB.wins, rowB.draws);
  }
  return LEAGUE_NAMES.flatMap((league) => rows.filter((row) => row.league === league)
    .sort((a, b) => b.points - a.points || a.seed - b.seed)
    .map((row, index) => ({ ...row, rank: index + 1 })));
}

export function buildLeaguesFromStandings(standings: StandingRow[], template: League[]): League[] {
  const templateByLeague = new Map(template.map((league) => [league.name, league]));
  return LEAGUE_NAMES.map((name) => ({
    id: templateByLeague.get(name)?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    showDay: templateByLeague.get(name)?.showDay ?? "Montag",
    wrestlers: standings.filter((row) => row.league === name).sort((a, b) => a.seed - b.seed).map((row) => ({
      wrestler: { id: row.wrestler.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: row.wrestler },
      seed: row.seed,
      startStatus: row.status || null,
    })),
  }));
}

export function validateCurrentLeagueComposition(standings: StandingRow[], matches: Match[], split: SplitName): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const leagueByStanding = new Map<string, LeagueName>();
  for (const league of LEAGUE_NAMES) {
    const rows = standings.filter((row) => row.league === league);
    if (rows.length !== 12) issues.push({ code: "CURRENT_LEAGUE_COUNT_INVALID", severity: "error", message: `${league} current composition has ${rows.length} wrestlers; expected 12.` });
    for (const row of rows) {
      const normalized = key(row.wrestler);
      if (leagueByStanding.has(normalized)) issues.push({ code: "CURRENT_WRESTLER_DUPLICATE", severity: "error", message: `${row.wrestler} appears in multiple current leagues.` });
      leagueByStanding.set(normalized, league);
    }
  }
  for (const match of matches.filter((entry) => entry.split === split)) {
    for (const wrestler of [match.wrestlerA, match.wrestlerB]) {
      const standingsLeague = leagueByStanding.get(key(wrestler));
      if (standingsLeague && standingsLeague !== match.league) issues.push({
        code: "CURRENT_COMPOSITION_MISMATCH",
        severity: "error",
        message: `Current league composition mismatch: ${wrestler} is scheduled in ${match.league} but standings roster places him in ${standingsLeague}.`,
        source: match.source,
      });
    }
  }
  return issues;
}
