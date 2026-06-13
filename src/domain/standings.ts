import { calculatePoints } from "./scoring";
import type { LeagueName, Match, MatchResult, StandingRow } from "./types";

export interface StandingSeed {
  league: LeagueName;
  wrestler: string;
  seed: number;
}

export function calculateStandings(
  seeds: StandingSeed[],
  matches: Match[],
  results: MatchResult[],
): StandingRow[] {
  const resultByMatch = new Map(results.map((result) => [result.matchId, result]));
  const rows = new Map<string, StandingRow>();

  for (const seed of seeds) {
    rows.set(`${seed.league}:${seed.wrestler}`, {
      league: seed.league,
      rank: 0,
      wrestler: seed.wrestler,
      seed: seed.seed,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      status: "",
    });
  }

  for (const match of matches) {
    const result = resultByMatch.get(match.id);
    if (!result) continue;
    const rowA = rows.get(`${match.league}:${match.wrestlerA}`);
    const rowB = rows.get(`${match.league}:${match.wrestlerB}`);
    if (!rowA || !rowB) continue;
    if (result.outcome === "draw") {
      rowA.matches += 1;
      rowA.draws += 1;
      rowB.matches += 1;
      rowB.draws += 1;
      continue;
    }
    if (result.outcome !== "decisive" || !result.winner || !result.loser) continue;
    const winner = rows.get(`${match.league}:${result.winner}`);
    const loser = rows.get(`${match.league}:${result.loser}`);
    if (!winner || !loser) continue;
    winner.matches += 1;
    winner.wins += 1;
    loser.matches += 1;
    loser.losses += 1;
  }

  const byLeague = new Map<LeagueName, StandingRow[]>();
  for (const row of rows.values()) {
    row.points = calculatePoints(row.wins, row.draws);
    const leagueRows = byLeague.get(row.league) ?? [];
    leagueRows.push(row);
    byLeague.set(row.league, leagueRows);
  }

  // Rank is intentionally left unset here. League Year 2 ranking requires
  // head-to-head and streak inputs; record calculation must not invent a fallback.
  return [...byLeague.values()].flatMap((leagueRows) => leagueRows);
}
