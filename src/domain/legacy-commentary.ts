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
  | "Global Championship Standard"
  | "League Title Standard"
  | "Elite Cup Specialist"
  | "Invincible Run Candidate"
  | "Hinrunde Dominance"
  | "Rückrunde Surge"
  | "Streak-Based Threat"
  | "Late-Season Collapse"
  | "Split-to-Split Improvement"
  | "Year-to-Year Legacy Growth"
  | "Global League Mainstay"
  | "Lower League Climber";

export interface LegacyCommentary {
  voice: "Legacy Analyst" | "Ringside Reporter" | "League Desk" | "Form Analyst" | "Championship Columnist" | "Season Review Desk";
  category: LegacyCommentaryCategory;
  text: string;
  excerpt: string;
  evidenceTags: string[];
  statCallouts: { label: string; value: string }[];
}

type Topic = { category: LegacyCommentaryCategory; priority: number; strength: number };

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
  const c = profile.checkpoints;
  const result: Topic[] = [];
  if (profile.globalChampionWins > 0) result.push({ category: "Global Championship Standard", priority: 1, strength: profile.globalChampionWins });
  if (profile.eliteCupWins > 0) result.push({ category: "Elite Cup Specialist", priority: 2, strength: profile.eliteCupWins + profile.doubles });
  if (profile.leagueWinsTotal > 0) result.push({ category: "League Title Standard", priority: 3, strength: profile.leagueWinsTotal + profile.doubles });
  if (profile.invincibleSplits > 0) result.push({ category: "Invincible Run Candidate", priority: 5, strength: profile.invincibleSplits });
  if (profile.invincibleHinrunden > 0) result.push({ category: "Hinrunde Dominance", priority: 6, strength: profile.invincibleHinrunden });
  if (profile.invincibleRueckrunden > 0) result.push({ category: "Rückrunde Surge", priority: 6, strength: profile.invincibleRueckrunden });
  if (profile.longestWinStreakOverall >= 4) result.push({ category: "Streak-Based Threat", priority: 7, strength: profile.longestWinStreakOverall });
  if (c?.hinrundePosition && c.finalPosition && c.finalPosition > c.hinrundePosition) result.push({ category: "Late-Season Collapse", priority: 9, strength: c.finalPosition - c.hinrundePosition });
  if (c?.previousSplitPosition && c.finalPosition && c.finalPosition < c.previousSplitPosition) result.push({ category: "Split-to-Split Improvement", priority: 10, strength: c.previousSplitPosition - c.finalPosition });
  if (c?.previousYearPosition && c.finalPosition && c.finalPosition < c.previousYearPosition) result.push({ category: "Year-to-Year Legacy Growth", priority: 10, strength: c.previousYearPosition - c.finalPosition });
  result.push({
    category: profile.currentLeague === "Global League" ? "Global League Mainstay" : "Lower League Climber",
    priority: profile.currentLeague === "Global League" ? 11 : 12,
    strength: 1,
  });
  return result.sort((a, b) => a.priority - b.priority || b.strength - a.strength || a.category.localeCompare(b.category));
}

function evidence(profile: LegacyProfile): string[] {
  const tags: string[] = [];
  if (profile.globalChampionWins > 0) tags.push(`${profile.globalChampionWins} Global ${profile.globalChampionWins === 1 ? "Title" : "Titles"}`);
  if (profile.leagueWinsTotal > 0) tags.push(`${profile.leagueWinsTotal} League ${profile.leagueWinsTotal === 1 ? "Title" : "Titles"}`);
  if (profile.eliteCupWins > 0) tags.push(`${profile.eliteCupWins} Elite Cup ${profile.eliteCupWins === 1 ? "Win" : "Wins"}`);
  if (profile.doubles > 0) tags.push(`${profile.doubles} League / Cup ${profile.doubles === 1 ? "Double" : "Doubles"}`);
  if (profile.invincibleSplits > 0) tags.push(`${profile.invincibleSplits} Invincible ${profile.invincibleSplits === 1 ? "Split" : "Splits"}`);
  if (profile.invincibleHinrunden > 0) tags.push(`${profile.invincibleHinrunden} Invincible ${profile.invincibleHinrunden === 1 ? "Hinrunde" : "Hinrunden"}`);
  if (profile.invincibleRueckrunden > 0) tags.push(`${profile.invincibleRueckrunden} Invincible ${profile.invincibleRueckrunden === 1 ? "Rückrunde" : "Rückrunden"}`);
  if (profile.longestWinStreakOverall > 0) tags.push(`${profile.longestWinStreakOverall}-Match Win Streak`);
  const c = profile.checkpoints;
  if (c?.hinrundePosition === 1) tags.push("Hinrunde Leader");
  if (c?.hinrundePosition && c.finalPosition && c.finalPosition > c.hinrundePosition) tags.push(`Finished P${c.finalPosition} from P${c.hinrundePosition}`);
  if (c?.previousSplitPosition && c.finalPosition && c.finalPosition < c.previousSplitPosition) tags.push(`Improved P${c.previousSplitPosition} to P${c.finalPosition}`);
  if (c?.previousYearPosition && c.finalPosition && c.finalPosition < c.previousYearPosition) tags.push(`Year-on-year P${c.previousYearPosition} to P${c.finalPosition}`);
  return tags;
}

function statCallouts(profile: LegacyProfile): LegacyCommentary["statCallouts"] {
  const available = [
    profile.globalChampionWins > 0 ? { label: "Global titles", value: String(profile.globalChampionWins) } : null,
    profile.leagueWinsTotal > 0 ? { label: "League titles", value: String(profile.leagueWinsTotal) } : null,
    profile.eliteCupWins > 0 ? { label: "Elite Cups", value: String(profile.eliteCupWins) } : null,
    profile.doubles > 0 ? { label: "Doubles", value: String(profile.doubles) } : null,
    profile.invincibleSplits > 0 ? { label: "Invincible splits", value: String(profile.invincibleSplits) } : null,
    profile.longestWinStreakOverall > 0 ? { label: "Longest streak", value: String(profile.longestWinStreakOverall) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);
  return available.slice(0, 3);
}

function supportingSentence(profile: LegacyProfile, category: LegacyCommentaryCategory): string | null {
  const candidates = [
    profile.eliteCupWins > 0 && category !== "Elite Cup Specialist"
      ? `${profile.eliteCupWins} recorded Elite Cup ${profile.eliteCupWins === 1 ? "win adds" : "wins add"} proven event-night value to that case.`
      : null,
    profile.doubles > 0
      ? `${profile.doubles} recorded league-and-cup ${profile.doubles === 1 ? "double shows" : "doubles show"} that the success crossed more than one competition.`
      : null,
    profile.invincibleSplits > 0 && category !== "Invincible Run Candidate"
      ? `${profile.invincibleSplits} invincible ${profile.invincibleSplits === 1 ? "split provides" : "splits provide"} separate evidence of sustained control.`
      : null,
    profile.longestWinStreakOverall > 0 && category !== "Streak-Based Threat"
      ? `A longest winning streak of ${profile.longestWinStreakOverall} also shows how long that level could be maintained.`
      : null,
  ].filter((sentence): sentence is string => sentence !== null);
  return candidates.length ? pick(profile, `support-${category}`, candidates) : null;
}

function excerpt(text: string): string {
  const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? text;
  return firstSentence.length <= 118 ? firstSentence : `${firstSentence.slice(0, 115).trimEnd()}…`;
}

export function generateLegacyCommentary(profile: LegacyProfile): LegacyCommentary {
  const category = topics(profile)[0].category;
  const tags = evidence(profile);
  const voice = pick(profile, "voice", ["Legacy Analyst", "Ringside Reporter", "League Desk", "Form Analyst", "Championship Columnist", "Season Review Desk"] as const);
  const c = profile.checkpoints;
  const primary: Record<LegacyCommentaryCategory, readonly string[]> = {
    "Global Championship Standard": [
      `${profile.wrestler}'s legacy case starts at the highest recorded level: ${profile.globalChampionWins} Global Championship ${profile.globalChampionWins === 1 ? "win" : "wins"}. That achievement gives the profile a measurable headline rather than one built on reputation alone.`,
      `The archive gives ${profile.wrestler} a top-level argument through ${profile.globalChampionWins} recorded Global ${profile.globalChampionWins === 1 ? "title" : "titles"}. It is the strongest available evidence in this career file and sets the standard for the rest of the résumé.`,
    ],
    "League Title Standard": [
      `${profile.wrestler} has turned league performance into silverware, with ${profile.leagueWinsTotal} recorded league ${profile.leagueWinsTotal === 1 ? "title" : "titles"}. That title return is the clearest reason this profile belongs in the legacy conversation.`,
      `The strongest line in ${profile.wrestler}'s archive is a haul of ${profile.leagueWinsTotal} league ${profile.leagueWinsTotal === 1 ? "championship" : "championships"}. The record supports a proven winner's case without requiring any unrecorded assumptions.`,
    ],
    "Elite Cup Specialist": [
      `${profile.wrestler} has delivered on the Elite Cup stage, recording ${profile.eliteCupWins} ${profile.eliteCupWins === 1 ? "victory" : "victories"} in the event. With no stronger title marker in the available row, that big-match result is the defining feature of the current legacy case.`,
      `Big-event evidence drives ${profile.wrestler}'s profile: ${profile.eliteCupWins} Elite Cup ${profile.eliteCupWins === 1 ? "win is" : "wins are"} already in the archive. That result gives the résumé a concrete trophy-night identity.`,
    ],
    "Invincible Run Candidate": [
      `${profile.wrestler} has ${profile.invincibleSplits} complete invincible ${profile.invincibleSplits === 1 ? "split" : "splits"} on record. Going through an entire split unbeaten is the clearest available measure of this profile's sustained dominance.`,
    ],
    "Hinrunde Dominance": [
      `${profile.wrestler} owns ${profile.invincibleHinrunden} invincible Hinrunde ${profile.invincibleHinrunden === 1 ? "run" : "runs"} in the archive. The evidence establishes exceptional first-half control, while stopping short of claiming the same for an unrecorded Rückrunde.`,
    ],
    "Rückrunde Surge": [
      `${profile.wrestler} has produced ${profile.invincibleRueckrunden} invincible Rückrunde ${profile.invincibleRueckrunden === 1 ? "run" : "runs"}. That makes the closing half of the split the standout feature in the available record.`,
    ],
    "Streak-Based Threat": [
      `${profile.wrestler}'s clearest current marker is a ${profile.longestWinStreakOverall}-match winning streak. With no title or cup win recorded in this row, the legacy argument rests on sustained weekly form rather than silverware.`,
      `A longest winning run of ${profile.longestWinStreakOverall} gives ${profile.wrestler} a credible form-based case. The archive supports a dangerous sustained stretch, but it does not turn that streak into a trophy the data has not recorded.`,
    ],
    "Late-Season Collapse": [
      `${profile.wrestler} moved from P${c?.hinrundePosition} after the Hinrunde to P${c?.finalPosition} in the final table. That late loss of ground is the defining trend in the available checkpoint record and leaves recovery as the next test.`,
    ],
    "Split-to-Split Improvement": [
      `${profile.wrestler} improved from P${c?.previousSplitPosition} in the previous split to P${c?.finalPosition} in the latest final table. The direction of travel is supported by recorded placements, not projection.`,
    ],
    "Year-to-Year Legacy Growth": [
      `${profile.wrestler} advanced from P${c?.previousYearPosition} in the prior year to P${c?.finalPosition} in the latest available finish. That year-to-year climb is the strongest growth signal in the current archive.`,
    ],
    "Global League Mainstay": [
      `${profile.wrestler} is currently listed in the Global League, which gives this profile top-division context even without a recorded title in the row. Based on the currently available archive data, league position is the firmest statement that can be made.`,
      `The available record places ${profile.wrestler} in the Global League but does not attach an unrecorded trophy to that status. For now, the legacy case is one of top-level presence, with future honours needed to deepen it.`,
    ],
    "Lower League Climber": [
      `${profile.wrestler}'s current archive is anchored in the ${profile.currentLeague}. Based on the currently available data, this is a development-stage legacy profile rather than one that can yet be defined by unrecorded honours.`,
      `At present, ${profile.wrestler} is listed in the ${profile.currentLeague}, and the tracker does not supply a stronger achievement marker. The fair reading is a career case still being built, not a résumé that should be inflated beyond the evidence.`,
    ],
  };

  const main = pick(profile, `copy-${category}`, primary[category]);
  const support = supportingSentence(profile, category);
  const text = support ? `${main} ${support}` : main;
  return { voice, category, text, excerpt: excerpt(text), evidenceTags: tags, statCallouts: statCallouts(profile) };
}
