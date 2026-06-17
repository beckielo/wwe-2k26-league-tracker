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

type SocialEventType =
  | "winning streak" | "losing streak" | "upset win" | "dominant leader" | "top-table race"
  | "promotion race" | "relegation danger" | "direct relegation pressure" | "Elite Cup race"
  | "title pressure" | "undefeated run" | "big upcoming match hype" | "rivalry storyline"
  | "strong comeback" | "late surge" | "collapse after strong start" | "fan hype"
  | "underdog support" | "league-wide tension" | "user league spotlight" | "cross-league headline";

interface SocialEvent {
  type: SocialEventType;
  league: LeagueName | "League-wide";
  wrestler?: string;
  wrestlerB?: string;
  points?: number;
  rank?: number;
  week?: number;
  score: number;
  evidence: string;
  fallback?: boolean;
}

const SOCIAL_HANDLES = ["@LeagueDesk", "@FormWatch", "@RingsideNoise", "@GrappleAnalytics", "@PromotionWatch", "@RelegationRadar", "@EliteCupTracker", "@KayfabeInsider", "@FanSection", "@UnderdogClub", "@PowerRankings", "@SplitWeekWatch", "@MainEventMeter", "@TableTalk", "@MomentumReport"];
const SOCIAL_OPENINGS = ["Big read", "Table check", "Worth tracking", "Quietly huge", "Do not miss this", "Sharp note", "Card watch", "Momentum check", "Split-week pulse", "League chatter", "Pressure meter", "Main-event lens"];
const SOCIAL_ENDINGS = ["the table will remember it", "that is where the split starts to bite", "this is exactly why every point matters", "the next card has real weight", "nobody should call that background noise", "the margins are getting brutal", "that story has legs", "the room is getting louder", "there is no easy week from here", "the standings make it impossible to ignore"];

const SOCIAL_MIDDLES: Record<SocialEventType, string[]> = {
  "winning streak": ["{wrestler}'s winning run is becoming the cleanest trend in {league}", "{wrestler} keeps stacking results and forcing the chase pack to answer", "{wrestler} has the form line everyone else in {league} is measuring against"],
  "losing streak": ["{wrestler} needs a reset before the slide becomes the whole story", "{wrestler}'s recent results have turned the next card into a response test", "{league} has no patience for a cold streak and {wrestler} knows it"],
  "upset win": ["{wrestler} just flipped a higher-ranked matchup into a standings jolt", "{wrestler} beating the table line gives {league} a fresh headline", "{wrestler} found the result that makes the rankings look twice"],
  "dominant leader": ["{wrestler} is setting the pace from Rank {rank} with {points} points", "{wrestler} has turned the top of {league} into a weekly chase", "Rank {rank} belongs to {wrestler} right now and the gap feels loud"],
  "top-table race": ["{wrestler} and {wrestlerB} have the top of {league} tight enough to swing fast", "{league}'s title lane is narrow with {wrestler} staring at {wrestlerB}", "the top-table race in {league} is close enough for one result to change the mood"],
  "promotion race": ["{wrestler} is sitting in the promotion conversation and every point is expensive", "{league}'s promotion line is pulling {wrestler} into must-watch territory", "{wrestler} has a real promotion path if the next card lands right"],
  "relegation danger": ["{wrestler} is close enough to danger that clean results matter immediately", "the lower-table pressure around {wrestler} is impossible to dress up", "{wrestler} needs points before the danger line starts doing the talking"],
  "direct relegation pressure": ["{wrestler} is in the direct pressure lane and cannot waste the next opening", "the direct relegation picture has {wrestler} under the brightest warning light", "{wrestler} is running out of comfortable weeks near the bottom"],
  "Elite Cup race": ["{wrestler} is hovering around the Elite Cup lane with no room for drift", "the top-four picture keeps {wrestler} under the spotlight", "{wrestler}'s Elite Cup route is alive but demanding"],
  "title pressure": ["{wrestler} has the champion-style pressure of protecting the top lane", "{league}'s leader pressure is on {wrestler} every time the bell goes", "{wrestler} is learning that leading the table makes every challenger louder"],
  "undefeated run": ["{wrestler} is still unbeaten and the whole league is counting", "the invincible watch around {wrestler} is officially a weekly storyline", "{wrestler}'s zero-loss run keeps tightening the spotlight"],
  "big upcoming match hype": ["{wrestler} vs {wrestlerB} has the kind of table context that sells itself", "{wrestler} and {wrestlerB} are about to put real split points in motion", "the upcoming {wrestler} vs {wrestlerB} card has proper league-table heat"],
  "rivalry storyline": ["{wrestler} and {wrestlerB} already have direct evidence behind this matchup", "the H2H thread between {wrestler} and {wrestlerB} gives this one extra bite", "{wrestler} vs {wrestlerB} is not just names; the record gives it context"],
  "strong comeback": ["{wrestler} has dragged momentum back toward the right side of the ledger", "{wrestler}'s response form is turning into a comeback arc", "the table is starting to reward {wrestler}'s rebound"],
  "late surge": ["{wrestler} is arriving late with enough points to bother the bracket", "{wrestler}'s late push is exactly the kind that ruins someone else's comfort", "{league} has a late-surge problem and {wrestler} is the name attached"],
  "collapse after strong start": ["{wrestler}'s early cushion is starting to look much thinner", "the strong start has cooled and {wrestler} needs to stop the leak", "{wrestler} cannot let a good opening split turn into a warning label"],
  "fan hype": ["{wrestler} is getting the loud fan-account treatment because the table backs it up", "the {wrestler} hype is not empty when the standings give it a base", "fans are circling {wrestler} as the name with juice this week"],
  "underdog support": ["{wrestler} has underdog energy with a real scheduled anchor", "the support for {wrestler} makes sense because the next card can change the view", "{wrestler} has a path to make the table blink"],
  "league-wide tension": ["{league} has several lanes close enough that one week can shake the board", "the split table is compressed enough for {league} to feel unstable", "{league} is carrying proper table tension across the card"],
  "user league spotlight": ["the user-controlled {league} card has the cleanest dashboard spotlight this week", "{league} is the show to watch because the live table is moving there now", "the dashboard focus is on {league} and the card has enough stakes"],
  "cross-league headline": ["the four-league picture has leaders, danger lines, and match hype all competing", "across the pyramid, the split is producing different kinds of pressure", "league-wide, the dashboard has more than one story worth tracking"],
};

export function socialTemplateCombinationCount(): number {
  return Object.values(SOCIAL_MIDDLES).reduce((sum, middle) => sum + middle.length * SOCIAL_OPENINGS.length * SOCIAL_ENDINGS.length * SOCIAL_HANDLES.length, 0);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return h >>> 0;
}
function pick<T>(items: T[], seed: string, offset = 0): T { return items[(hashSeed(seed) + offset) % items.length]; }
function fill(template: string, event: SocialEvent): string {
  return template.replaceAll("{league}", event.league).replaceAll("{wrestler}", event.wrestler ?? "the field").replaceAll("{wrestlerB}", event.wrestlerB ?? "the chase pack").replaceAll("{points}", String(event.points ?? 0)).replaceAll("{rank}", String(event.rank ?? "—"));
}
function eventText(event: SocialEvent, index: number): SocialComment {
  const seed = `${event.league}|${event.type}|${event.wrestler}|${event.wrestlerB}|${event.rank}|${event.points}|${event.week}|${event.evidence}|${index}`;
  const opening = pick(SOCIAL_OPENINGS, seed, 3);
  const middle = fill(pick(SOCIAL_MIDDLES[event.type], seed, 7), event);
  const ending = pick(SOCIAL_ENDINGS, seed, 11);
  return { handle: pick(SOCIAL_HANDLES, seed, 17), leagueTag: event.league, eventTag: event.type, text: `${opening}: ${middle}; ${ending}.`, evidence: event.evidence };
}

function addEvent(events: SocialEvent[], event: SocialEvent) { events.push(event); }

export function generateSocialFeed(standings: StandingRow[], matches: Match[], results: ConfirmedResult[], userLeague: LeagueName, limit = 6): SocialComment[] {
  const events: SocialEvent[] = [];
  const byLeague = new Map<LeagueName, StandingRow[]>();
  for (const row of standings) byLeague.set(row.league, [...(byLeague.get(row.league) ?? []), row]);
  for (const [league, rows] of byLeague) {
    const sorted = [...rows].sort((a,b) => a.rank - b.rank);
    const leader = sorted[0];
    if (!leader) continue;
    if (leader.matches >= 3 && leader.wins === leader.matches) addEvent(events, { type: "undefeated run", league, wrestler: leader.wrestler, points: leader.points, rank: leader.rank, score: 98, evidence: `${leader.wins}-${leader.draws}-${leader.losses}, Rank ${leader.rank}` });
    if (leader.matches >= 3 && leader.points >= 10) addEvent(events, { type: "dominant leader", league, wrestler: leader.wrestler, points: leader.points, rank: leader.rank, score: 90, evidence: `Rank ${leader.rank}, ${leader.points} pts` });
    if (leader) addEvent(events, { type: "title pressure", league, wrestler: leader.wrestler, points: leader.points, rank: leader.rank, score: 75, evidence: `Current Rank ${leader.rank}` });
    const race = sorted[1] && leader.points - sorted[1].points <= 3 ? sorted[1] : null;
    if (race) addEvent(events, { type: "top-table race", league, wrestler: leader.wrestler, wrestlerB: race.wrestler, points: leader.points, rank: leader.rank, score: 88, evidence: `${leader.points}-${race.points} points at the top` });
    for (const row of sorted) {
      if (row.rank <= 2 && row.matches) addEvent(events, { type: "promotion race", league, wrestler: row.wrestler, rank: row.rank, points: row.points, score: 62 - row.rank, evidence: `Rank ${row.rank}, ${row.points} pts` });
      if (row.rank <= 4 && row.matches) addEvent(events, { type: "Elite Cup race", league, wrestler: row.wrestler, rank: row.rank, points: row.points, score: 58 - row.rank, evidence: `Top-four context: Rank ${row.rank}` });
      if (row.rank >= 9 && row.matches) addEvent(events, { type: row.rank >= 11 ? "direct relegation pressure" : "relegation danger", league, wrestler: row.wrestler, rank: row.rank, points: row.points, score: 70 + row.rank, evidence: `Rank ${row.rank}, ${row.points} pts` });
      if (row.wins >= 3 && row.wins > row.losses) addEvent(events, { type: "winning streak", league, wrestler: row.wrestler, rank: row.rank, points: row.points, score: 66 + row.wins, evidence: `${row.wins} wins recorded` });
      if (row.losses >= 3 && row.losses > row.wins) addEvent(events, { type: "losing streak", league, wrestler: row.wrestler, rank: row.rank, points: row.points, score: 64 + row.losses, evidence: `${row.losses} losses recorded` });
    }
    if (sorted[0] && sorted[5] && sorted[0].points - sorted[5].points <= 6) addEvent(events, { type: "league-wide tension", league, wrestler: sorted[0].wrestler, wrestlerB: sorted[5].wrestler, score: 59, evidence: `Ranks 1-6 separated by ${sorted[0].points - sorted[5].points} pts` });
  }
  for (const result of results.filter((r) => r.resultType === "Winner" && r.winner)) {
    const loser = result.wrestlerA === result.winner ? result.wrestlerB : result.wrestlerA;
    const winnerRow = standings.find((r) => r.league === result.league && r.wrestler === result.winner);
    const loserRow = standings.find((r) => r.league === result.league && r.wrestler === loser);
    addEvent(events, { type: winnerRow && loserRow && winnerRow.rank > loserRow.rank ? "upset win" : "strong comeback", league: result.league, wrestler: result.winner ?? undefined, wrestlerB: loser, week: result.week, rank: winnerRow?.rank, score: winnerRow && loserRow && winnerRow.rank > loserRow.rank ? 86 : 55, evidence: `Week ${result.week} confirmed result` });
    addEvent(events, { type: "rivalry storyline", league: result.league, wrestler: result.wrestlerA, wrestlerB: result.wrestlerB, week: result.week, score: 54, evidence: `Head-to-head result recorded Week ${result.week}` });
  }
  for (const match of matches.slice(0, 18)) {
    const a = standings.find((r) => r.league === match.league && r.wrestler === match.wrestlerA);
    const b = standings.find((r) => r.league === match.league && r.wrestler === match.wrestlerB);
    addEvent(events, { type: "big upcoming match hype", league: match.league, wrestler: match.wrestlerA, wrestlerB: match.wrestlerB, week: match.week, score: match.league === userLeague ? 73 : 49, evidence: `Scheduled Week ${match.week}, Bout ${match.matchNumber}`, fallback: true });
    const underdog = a && b ? (a.rank > b.rank ? a : b) : a ?? b;
    if (underdog) addEvent(events, { type: "underdog support", league: match.league, wrestler: underdog.wrestler, wrestlerB: underdog.wrestler === match.wrestlerA ? match.wrestlerB : match.wrestlerA, rank: underdog.rank, score: 45, evidence: `Real upcoming matchup Week ${match.week}`, fallback: true });
    if (match.league === userLeague) addEvent(events, { type: "user league spotlight", league: match.league, wrestler: match.wrestlerA, wrestlerB: match.wrestlerB, week: match.week, score: 72, evidence: `User league scheduled Week ${match.week}`, fallback: true });
  }
  if (byLeague.size > 1) addEvent(events, { type: "cross-league headline", league: "League-wide", score: 50, evidence: `${byLeague.size} leagues in current live table`, fallback: true });

  const chosen: SocialComment[] = [];
  const openingCounts = new Map<string, number>(), eventCounts = new Map<string, number>(), wrestlerCounts = new Map<string, number>(), leagueCounts = new Map<string, number>();
  for (const [index, event] of events.sort((a,b) => b.score - a.score || `${a.league}${a.type}${a.wrestler}`.localeCompare(`${b.league}${b.type}${b.wrestler}`)).entries()) {
    const comment = eventText(event, index);
    const opening = comment.text.split(":", 1)[0];
    if (chosen.some((c) => c.text === comment.text)) continue;
    if ((openingCounts.get(opening) ?? 0) >= 1) continue;
    if ((eventCounts.get(event.type) ?? 0) >= 1 && chosen.length >= 2) continue;
    if (event.wrestler && (wrestlerCounts.get(event.wrestler) ?? 0) >= 2) continue;
    if (event.league !== "League-wide" && (leagueCounts.get(event.league) ?? 0) >= 2 && chosen.length >= 3) continue;
    chosen.push(comment);
    openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
    eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
    if (event.wrestler) wrestlerCounts.set(event.wrestler, (wrestlerCounts.get(event.wrestler) ?? 0) + 1);
    if (event.league !== "League-wide") leagueCounts.set(event.league, (leagueCounts.get(event.league) ?? 0) + 1);
    if (chosen.length >= Math.max(3, Math.min(6, limit))) break;
  }
  return chosen;
}
