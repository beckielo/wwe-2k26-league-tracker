import type { LeagueName } from "./types";

export interface LegacyCheckpoint {
  hinrundePosition?: number;
  midSplitPosition?: number;
  finalPosition?: number;
  previousSplitPosition?: number;
  previousYearPosition?: number;
}

export interface LegacyProfile {
  wrestler: string;
  currentLeague: LeagueName;
  goatStatusTier: string | null;
  leagueWinsTotal: number;
  globalChampionWins: number;
  eliteCupWins: number;
  doubles: number;
  invincibleSplits: number;
  invincibleHinrunden: number;
  invincibleRueckrunden: number;
  longestWinStreakOverall: number;
  sourceCommentary: string | null;
  checkpoints?: LegacyCheckpoint;
}

export type LegacyCommentaryCategory =
  | "Dominant Champion"
  | "Elite Cup Specialist"
  | "Streak-Based Threat"
  | "Invincible Run Candidate"
  | "Hinrunde Dominance"
  | "Rückrunde Surge"
  | "Late-Season Collapse"
  | "Split-to-Split Improvement"
  | "Year-to-Year Legacy Growth"
  | "Global League Mainstay"
  | "Lower League Climber";

export interface LegacyCommentary {
  voice: "Legacy Analyst" | "Ringside Reporter" | "League Desk" | "Form Analyst" | "Championship Columnist";
  category: LegacyCommentaryCategory;
  text: string;
  evidenceTags: string[];
}

type Topic = { category: LegacyCommentaryCategory; weight: number };

function deterministicIndex(profile: LegacyProfile, salt: string, length: number): number {
  const key = `${profile.wrestler}|${profile.currentLeague}|${profile.leagueWinsTotal}|${profile.globalChampionWins}|${profile.eliteCupWins}|${profile.doubles}|${profile.invincibleSplits}|${profile.invincibleHinrunden}|${profile.invincibleRueckrunden}|${profile.longestWinStreakOverall}|${JSON.stringify(profile.checkpoints ?? {})}|${salt}`;
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % length;
}

function pick<T>(profile: LegacyProfile, salt: string, values: readonly T[]): T {
  return values[deterministicIndex(profile, salt, values.length)];
}

function topics(profile: LegacyProfile): Topic[] {
  const checkpoints = profile.checkpoints;
  const result: Topic[] = [];
  if (profile.globalChampionWins > 0 || profile.leagueWinsTotal > 0) result.push({ category: "Dominant Champion", weight: profile.globalChampionWins * 16 + profile.leagueWinsTotal * 10 + profile.doubles * 12 });
  if (profile.eliteCupWins > 0) result.push({ category: "Elite Cup Specialist", weight: profile.eliteCupWins * 15 + profile.doubles * 10 });
  if (profile.invincibleSplits > 0) result.push({ category: "Invincible Run Candidate", weight: profile.invincibleSplits * 18 });
  if (profile.invincibleHinrunden > 0) result.push({ category: "Hinrunde Dominance", weight: profile.invincibleHinrunden * 13 });
  if (profile.invincibleRueckrunden > 0) result.push({ category: "Rückrunde Surge", weight: profile.invincibleRueckrunden * 13 });
  if (profile.longestWinStreakOverall > 0) result.push({ category: "Streak-Based Threat", weight: Math.min(profile.longestWinStreakOverall, 12) });
  if (checkpoints?.hinrundePosition && checkpoints.finalPosition && checkpoints.finalPosition > checkpoints.hinrundePosition) result.push({ category: "Late-Season Collapse", weight: (checkpoints.finalPosition - checkpoints.hinrundePosition) * 7 });
  if (checkpoints?.previousSplitPosition && checkpoints.finalPosition && checkpoints.finalPosition < checkpoints.previousSplitPosition) result.push({ category: "Split-to-Split Improvement", weight: (checkpoints.previousSplitPosition - checkpoints.finalPosition) * 7 });
  if (checkpoints?.previousYearPosition && checkpoints.finalPosition && checkpoints.finalPosition < checkpoints.previousYearPosition) result.push({ category: "Year-to-Year Legacy Growth", weight: (checkpoints.previousYearPosition - checkpoints.finalPosition) * 6 });
  result.push({
    category: profile.currentLeague === "Global League" ? "Global League Mainstay" : "Lower League Climber",
    weight: profile.currentLeague === "Global League" ? 3 : 2,
  });
  return result.sort((a, b) => b.weight - a.weight || a.category.localeCompare(b.category));
}

function evidence(profile: LegacyProfile): string[] {
  const tags: string[] = [];
  if (profile.globalChampionWins > 0) tags.push("Global Champion");
  if (profile.leagueWinsTotal > 0) tags.push(`${profile.leagueWinsTotal} League ${profile.leagueWinsTotal === 1 ? "Title" : "Titles"}`);
  if (profile.eliteCupWins > 0) tags.push("Elite Cup Winner");
  if (profile.doubles > 0) tags.push("League / Cup Double");
  if (profile.invincibleSplits > 0) tags.push("Invincible Split");
  if (profile.invincibleHinrunden > 0) tags.push("Invincible Hinrunde");
  if (profile.invincibleRueckrunden > 0) tags.push("Invincible Rückrunde");
  if (profile.longestWinStreakOverall > 0) tags.push(`${profile.longestWinStreakOverall}-Match Win Streak`);
  const c = profile.checkpoints;
  if (c?.hinrundePosition === 1) tags.push("Hinrunde Leader");
  if (c?.hinrundePosition && c.finalPosition && c.finalPosition > c.hinrundePosition) tags.push("Late Collapse");
  if (c?.previousSplitPosition && c.finalPosition && c.finalPosition < c.previousSplitPosition) tags.push("Previous Split Improvement");
  if (c?.previousYearPosition && c.finalPosition && c.finalPosition < c.previousYearPosition) tags.push("Year-to-Year Improvement");
  return tags;
}

export function generateLegacyCommentary(profile: LegacyProfile): LegacyCommentary {
  const category = topics(profile)[0].category;
  const tags = evidence(profile);
  const voice = pick(profile, "voice", ["Legacy Analyst", "Ringside Reporter", "League Desk", "Form Analyst", "Championship Columnist"] as const);
  const titleSummary = profile.leagueWinsTotal > 0
    ? `${profile.leagueWinsTotal} recorded league ${profile.leagueWinsTotal === 1 ? "title" : "titles"}`
    : null;
  const streakSummary = profile.longestWinStreakOverall > 0 ? `a longest winning streak of ${profile.longestWinStreakOverall}` : null;
  const achievementSummary = [
    titleSummary,
    profile.globalChampionWins > 0 ? `${profile.globalChampionWins} Global championship ${profile.globalChampionWins === 1 ? "win" : "wins"}` : null,
    profile.eliteCupWins > 0 ? `${profile.eliteCupWins} Elite Cup ${profile.eliteCupWins === 1 ? "win" : "wins"}` : null,
    streakSummary,
  ].filter(Boolean);
  const facts = achievementSummary.slice(0, 2).join(" and ");
  const c = profile.checkpoints;

  const categoryCopy: Record<LegacyCommentaryCategory, readonly string[]> = {
    "Dominant Champion": [
      `${profile.wrestler}'s record is led by ${facts}. The championship evidence is the clearest part of the case, and it stands without needing projection.`,
      `The title column gives ${profile.wrestler} a concrete historical argument: ${facts}. That is established achievement rather than reputation.`,
    ],
    "Elite Cup Specialist": [
      `${profile.wrestler} has converted the Elite Cup stage into a defining result, with ${profile.eliteCupWins} recorded ${profile.eliteCupWins === 1 ? "victory" : "victories"}. ${profile.doubles > 0 ? `The record also includes ${profile.doubles} league-and-cup double.` : "The cup result is the strongest available legacy marker."}`,
      `Big-event evidence drives this profile. ${profile.wrestler} owns ${profile.eliteCupWins} Elite Cup ${profile.eliteCupWins === 1 ? "win" : "wins"}${profile.doubles > 0 ? ` and ${profile.doubles} completed double` : ""}.`,
    ],
    "Streak-Based Threat": [
      `${profile.wrestler}'s strongest available form marker is a ${profile.longestWinStreakOverall}-match winning streak. Until another recorded honour is added, sustained weekly control is the central legacy evidence.`,
      `A longest winning run of ${profile.longestWinStreakOverall} makes ${profile.wrestler} a form-driven case. The numbers support danger over a sustained stretch, not an achievement the tracker has not recorded.`,
    ],
    "Invincible Run Candidate": [
      `${profile.wrestler} has ${profile.invincibleSplits} recorded invincible ${profile.invincibleSplits === 1 ? "split" : "splits"}. That unbeaten full-split evidence is the defining feature of the profile.`,
      `The cleanest line in ${profile.wrestler}'s archive is invincibility across ${profile.invincibleSplits} complete ${profile.invincibleSplits === 1 ? "split" : "splits"}, a standard few records can match.`,
    ],
    "Hinrunde Dominance": [
      `${profile.wrestler} has ${profile.invincibleHinrunden} invincible Hinrunde ${profile.invincibleHinrunden === 1 ? "run" : "runs"} on record. The first-half dominance is documented; the commentary does not assume an equally strong Rückrunde.`,
    ],
    "Rückrunde Surge": [
      `${profile.wrestler} has ${profile.invincibleRueckrunden} invincible Rückrunde ${profile.invincibleRueckrunden === 1 ? "run" : "runs"} recorded. The late-split evidence makes the closing half the standout section of the résumé.`,
    ],
    "Late-Season Collapse": [
      `${profile.wrestler} moved from ${c?.hinrundePosition} after the Hinrunde to ${c?.finalPosition} at the finish. That drop is the key available trend and puts pressure on the next complete split.`,
    ],
    "Split-to-Split Improvement": [
      `${profile.wrestler} improved from ${c?.previousSplitPosition} in the previous split to ${c?.finalPosition} in the latest final table. The direction of travel is supported by the recorded placements.`,
    ],
    "Year-to-Year Legacy Growth": [
      `${profile.wrestler} advanced from ${c?.previousYearPosition} in the prior year to ${c?.finalPosition} in the latest available finish. The year-to-year placement change is the strongest growth signal.`,
    ],
    "Global League Mainstay": [
      `${profile.wrestler} is currently listed in the Global League${streakSummary ? `, with ${streakSummary}` : ""}. The available league and form fields define this profile.`,
      `The available record places ${profile.wrestler} in the Global League${streakSummary ? ` and credits ${streakSummary}` : ""}. The analysis stays within those recorded markers.`,
    ],
    "Lower League Climber": [
      `${profile.wrestler}'s current record is anchored in the ${profile.currentLeague}${streakSummary ? ` and ${streakSummary}` : ""}. The profile is defined by the league and form evidence currently available.`,
      `At present, ${profile.wrestler} is listed in the ${profile.currentLeague}${streakSummary ? ` with ${streakSummary}` : ""}. That is the documented foundation of the current legacy profile.`,
    ],
  };

  return { voice, category, text: pick(profile, `copy-${category}`, categoryCopy[category]), evidenceTags: tags };
}
