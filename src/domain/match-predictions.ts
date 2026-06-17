import type { LeagueName, Match, StandingRow } from "./types";
import type { ConfirmedResult } from "./tracker-state";

export type PredictionConfidence = "low" | "medium" | "high";

export interface MatchPrediction {
  wrestlerA: string;
  wrestlerB: string;
  probabilityA: number;
  probabilityB: number;
  confidence: PredictionConfidence;
  factors: string[];
  explanation: string;
  dataQualityWarnings: string[];
}

export interface SocialComment {
  handle: string;
  leagueTag: LeagueName | "League-wide";
  eventTag: string;
  text: string;
  evidence: string;
}

const MIN = 15;
const MAX = 85;
const LEAGUE_WEIGHT: Record<LeagueName, number> = { "Global League": 4, "Continental League": 3, "National League": 2, "Regional League": 1 };

function clamp(n: number) { return Math.max(MIN, Math.min(MAX, n)); }
function rowScore(row?: StandingRow): number { return row ? (13 - row.rank) * 0.9 + (row.matches ? (row.points / row.matches) * 4 + (row.wins / row.matches) * 6 : 0) : 0; }

function recentForm(wrestler: string, results: ConfirmedResult[]): { score: number; label: string } {
  const recent = results.filter((r) => r.wrestlerA === wrestler || r.wrestlerB === wrestler).sort((a,b) => a.week - b.week).slice(-5);
  let score = 0;
  for (const r of recent) score += r.resultType === "Draw" || r.resultType === "No Contest" ? 0 : r.winner === wrestler ? 1 : -1;
  return { score, label: `${recent.length} recent result${recent.length === 1 ? "" : "s"}` };
}

function h2h(a: string, b: string, results: ConfirmedResult[]): number {
  let score = 0;
  for (const r of results) {
    if (!((r.wrestlerA === a && r.wrestlerB === b) || (r.wrestlerA === b && r.wrestlerB === a))) continue;
    if (r.resultType === "Draw" || r.resultType === "No Contest") continue;
    score += r.winner === a ? 1 : -1;
  }
  return score;
}

export function predictMatch(match: Match, standings: StandingRow[], results: ConfirmedResult[]): MatchPrediction {
  const a = standings.find((row) => row.league === match.league && row.wrestler === match.wrestlerA);
  const b = standings.find((row) => row.league === match.league && row.wrestler === match.wrestlerB);
  const warnings: string[] = [];
  if (!a || !b) warnings.push("Missing current table row; neutral fallback used for unavailable table factors.");
  let edge = (rowScore(a) - rowScore(b)) * 1.7;
  const factors: string[] = [];
  if (a && b && a.rank !== b.rank) factors.push("table position");
  const fa = recentForm(match.wrestlerA, results);
  const fb = recentForm(match.wrestlerB, results);
  if (fa.score !== fb.score) { edge += (fa.score - fb.score) * 3.2; factors.push("recent form"); }
  const h = h2h(match.wrestlerA, match.wrestlerB, results);
  if (h !== 0) { edge += h * 2.5; factors.push("head-to-head"); }
  edge += LEAGUE_WEIGHT[match.league] * 0.25;
  if (a?.matches === 0 && b?.matches === 0 && fa.score === 0 && fb.score === 0 && h === 0) warnings.push("Limited completed data; prediction kept close to neutral.");
  const probabilityA = Math.round(clamp(50 + edge));
  const probabilityB = 100 - probabilityA;
  const lead = probabilityA === probabilityB ? null : probabilityA > probabilityB ? match.wrestlerA : match.wrestlerB;
  const confidence: PredictionConfidence = factors.length >= 3 ? "high" : factors.length >= 1 ? "medium" : "low";
  const top = factors.slice(0, 3);
  const explanation = lead
    ? `${top.includes("recent form") ? "Form" : top.includes("head-to-head") ? "H2H" : "Table"} edge: ${lead} has the strongest available indicators.`
    : "Neutral read: available data does not separate the matchup clearly.";
  return { wrestlerA: match.wrestlerA, wrestlerB: match.wrestlerB, probabilityA, probabilityB, confidence, factors: top, explanation, dataQualityWarnings: warnings };
}

export function generateSocialFeed(standings: StandingRow[], matches: Match[], results: ConfirmedResult[], userLeague: LeagueName, limit = 6): SocialComment[] {
  const comments: SocialComment[] = [];
  const byLeague = new Map<LeagueName, StandingRow[]>();
  for (const row of standings) byLeague.set(row.league, [...(byLeague.get(row.league) ?? []), row]);
  for (const [league, rows] of byLeague) {
    const sorted = [...rows].sort((a,b) => a.rank - b.rank);
    const leader = sorted[0];
    if (leader?.matches >= 3 && leader.wins === leader.matches) comments.push({ handle: "@LeagueDesk", leagueTag: league, eventTag: "Unbeaten leader", text: `${leader.wrestler} still unbeaten at the top of the ${league}. That is control, not noise.`, evidence: `${leader.wins}-${leader.draws}-${leader.losses}, Rank ${leader.rank}` });
    const race = sorted[1] && leader && leader.points - sorted[1].points <= 2 ? sorted[1] : null;
    if (leader && race) comments.push({ handle: "@TableWatch", leagueTag: league, eventTag: "Close title race", text: `${league} is tight: ${race.wrestler} is close enough to make every result around ${leader.wrestler} feel huge.`, evidence: `${leader.points}-${race.points} points at the top` });
    const danger = sorted.find((r) => r.rank >= 9 && r.matches >= 1);
    if (danger) comments.push({ handle: "@RingsideNoise", leagueTag: league, eventTag: "Pressure zone", text: `${danger.wrestler} is living in the pressure zone now. The next card has to be cleaner.`, evidence: `Rank ${danger.rank}, ${danger.points} pts` });
  }
  const latest = [...results].sort((a,b) => b.week - a.week).find((r) => r.resultType === "Winner" && r.winner);
  if (latest) comments.push({ handle: "@FormWatch", leagueTag: latest.league, eventTag: "Latest result", text: `${latest.winner} picked up the kind of win that changes the room temperature in the ${latest.league}.`, evidence: `Week ${latest.week} confirmed result` });
  for (const match of matches.filter((m) => m.league === userLeague).slice(0, 3)) comments.push({ handle: "@HypeAccount", leagueTag: match.league, eventTag: "Upcoming match", text: `${match.wrestlerA} vs ${match.wrestlerB} has proper league-table tension around it.`, evidence: `Scheduled Week ${match.week}, Bout ${match.matchNumber}` });
  const unique = comments.filter((c, i, arr) => arr.findIndex((x) => x.text === c.text) === i);
  return unique.slice(0, Math.max(3, Math.min(6, limit)));
}
