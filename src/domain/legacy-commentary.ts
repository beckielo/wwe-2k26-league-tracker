import type { LeagueName } from "./types";

export interface LegacyCheckpoint {
  hinrundePosition?: number;
  midSplitPosition?: number;
  finalPosition?: number;
  previousSplitPosition?: number;
  previousYearPosition?: number;
}

export type LegacyTier = "S" | "A" | "B" | "C" | "D";

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
  legacyTier?: LegacyTier;
  legacyScore?: number;
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

export type LegacyJournalistVoice = "Title traditionalist" | "Dominance analyst" | "Streak/value analyst" | "Event prestige columnist" | "Consistency historian" | "Skeptical résumé analyst" | "Upside / trajectory analyst" | "Comparative peer analyst" | "Championship-first analyst" | "Big-event analyst" | "Consistency analyst" | "Promotion/storyline analyst" | "Skeptical columnist";

export interface LegacyCommentary {
  voice: LegacyJournalistVoice;
  category: LegacyCommentaryCategory;
  text: string;
  excerpt: string;
  evidenceTags: string[];
  statCallouts: { label: string; value: string }[];
  feature: boolean;
}


export const LEGACY_TIER_ORDER: LegacyTier[] = ["S", "A", "B", "C", "D"];

export function legacyScore(profile: LegacyProfile): number {
  const leagueLevelBonus = profile.currentLeague === "Global League" ? 3 : profile.currentLeague === "Continental League" ? 2 : profile.currentLeague === "National League" ? 1 : 0;
  return profile.globalChampionWins * 18
    + Math.max(0, profile.leagueWinsTotal - profile.globalChampionWins) * 8
    + profile.eliteCupWins * 16
    + profile.doubles * 10
    + profile.invincibleSplits * 12
    + (profile.invincibleHinrunden + profile.invincibleRueckrunden) * 6
    + Math.min(profile.longestWinStreakOverall, 12)
    + leagueLevelBonus;
}

export function legacyTier(profile: LegacyProfile): LegacyTier {
  const score = legacyScore(profile);
  if (score >= 36 || profile.globalChampionWins >= 2 || (profile.globalChampionWins >= 1 && profile.eliteCupWins >= 1)) return "S";
  if (score >= 20 || profile.globalChampionWins >= 1 || profile.eliteCupWins >= 1 || profile.leagueWinsTotal >= 2) return "A";
  if (score >= 10 || profile.leagueWinsTotal >= 1 || profile.longestWinStreakOverall >= 7) return "B";
  if (score >= 4 || profile.currentLeague === "Global League" || profile.longestWinStreakOverall >= 4) return "C";
  return "D";
}

export function withLegacyTier(profile: LegacyProfile): LegacyProfile {
  const score = legacyScore(profile);
  return { ...profile, legacyScore: score, legacyTier: legacyTier(profile) };
}

export function sortLegacyProfiles(profiles: LegacyProfile[]): LegacyProfile[] {
  return profiles.map(withLegacyTier).sort((a, b) => LEGACY_TIER_ORDER.indexOf(a.legacyTier ?? "D") - LEGACY_TIER_ORDER.indexOf(b.legacyTier ?? "D") || a.wrestler.localeCompare(b.wrestler));
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

function tierBProfile(profile: LegacyProfile): LegacyCommentary["voice"] {
  const voices = ["Title traditionalist", "Event prestige columnist", "Dominance analyst", "Streak/value analyst", "Consistency historian", "Skeptical résumé analyst", "Upside / trajectory analyst", "Comparative peer analyst"] as const;
  return pick(profile, "tier-b-journalist", voices);
}

export interface LegacyComparativeSignals {
  bestLongestStreak: number;
  tiedBestLongestStreak: boolean;
  topTierStreak: boolean;
  strongestNoTitleProfile: boolean;
  strongestSingleTitleProfile: boolean;
  bestNonEliteCupResume: boolean;
  strongestInvincibleBasedCase: boolean;
  strongestTitleBasedCase: boolean;
  strongestEventNightCase: boolean;
  strongestConsistencyWithoutSilverware: boolean;
  outlierDominanceMarker: boolean;
  weakResumeVersusPeersInSameTier: boolean;
  overperformingResumeForCurrentTier: boolean;
  underAccomplishedRelativeToRawStreakProfile: boolean;
}

export function comparativeSignals(profile: LegacyProfile, peers: LegacyProfile[] = [profile]): LegacyComparativeSignals {
  const field = peers.length ? peers : [profile];
  const score = legacyScore(profile);
  const best = (fn: (p: LegacyProfile) => number) => Math.max(...field.map(fn));
  const tier = profile.legacyTier ?? legacyTier(profile);
  const sameTier = field.filter((p) => (p.legacyTier ?? legacyTier(p)) === tier);
  const sameAvg = sameTier.reduce((sum, p) => sum + legacyScore(p), 0) / Math.max(1, sameTier.length);
  const titleCount = (p: LegacyProfile) => p.leagueWinsTotal + p.globalChampionWins + p.eliteCupWins;
  const noTitles = field.filter((p) => titleCount(p) === 0);
  const singleTitles = field.filter((p) => titleCount(p) === 1);
  const bestLongestStreak = best((p) => p.longestWinStreakOverall);
  return {
    bestLongestStreak,
    tiedBestLongestStreak: profile.longestWinStreakOverall > 0 && profile.longestWinStreakOverall === bestLongestStreak,
    topTierStreak: profile.longestWinStreakOverall > 0 && profile.longestWinStreakOverall >= Math.max(7, bestLongestStreak - 1),
    strongestNoTitleProfile: titleCount(profile) === 0 && noTitles.length > 0 && score === Math.max(...noTitles.map(legacyScore)),
    strongestSingleTitleProfile: titleCount(profile) === 1 && singleTitles.length > 0 && score === Math.max(...singleTitles.map(legacyScore)),
    bestNonEliteCupResume: profile.eliteCupWins === 0 && score === Math.max(...field.filter((p) => p.eliteCupWins === 0).map(legacyScore), -1),
    strongestInvincibleBasedCase: profile.invincibleSplits + profile.invincibleHinrunden + profile.invincibleRueckrunden > 0 && (profile.invincibleSplits * 3 + profile.invincibleHinrunden + profile.invincibleRueckrunden) === best((p) => p.invincibleSplits * 3 + p.invincibleHinrunden + p.invincibleRueckrunden),
    strongestTitleBasedCase: profile.leagueWinsTotal + profile.globalChampionWins === best((p) => p.leagueWinsTotal + p.globalChampionWins),
    strongestEventNightCase: profile.eliteCupWins > 0 && profile.eliteCupWins === best((p) => p.eliteCupWins),
    strongestConsistencyWithoutSilverware: titleCount(profile) === 0 && profile.longestWinStreakOverall === Math.max(...noTitles.map((p) => p.longestWinStreakOverall), -1),
    outlierDominanceMarker: profile.longestWinStreakOverall >= 10 || profile.invincibleSplits > 0,
    weakResumeVersusPeersInSameTier: sameTier.length > 1 && score <= sameAvg - 4,
    overperformingResumeForCurrentTier: sameTier.length > 1 && score >= sameAvg + 4,
    underAccomplishedRelativeToRawStreakProfile: profile.longestWinStreakOverall >= 7 && titleCount(profile) === 0,
  };
}

function comparativeSentence(profile: LegacyProfile, signals: LegacyComparativeSignals): string | null {
  const candidates = [
    signals.tiedBestLongestStreak ? `Against the full legacy field, the ${profile.longestWinStreakOverall}-match streak is tied for the best recorded run in the file.` : null,
    !signals.tiedBestLongestStreak && signals.topTierStreak ? `Relative to peers, the ${profile.longestWinStreakOverall}-match streak sits in the top band of recorded form markers.` : null,
  ];
  if (signals.strongestNoTitleProfile) candidates.push(`Among profiles without recorded silverware, ${profile.wrestler} has the strongest peer-relative case on the current inputs.`);
  if (signals.underAccomplishedRelativeToRawStreakProfile) candidates.push(`The résumé is under-accomplished relative to that raw streak profile because the same row still records no title or Elite Cup win.`);
  if (signals.strongestEventNightCase) candidates.push(`The Elite Cup line is not just present; it matches the strongest event-night count in the field.`);
  if (signals.strongestInvincibleBasedCase) candidates.push(`The invincible-run evidence gives this file one of the strongest dominance bases in the archive.`);
  if (signals.weakResumeVersusPeersInSameTier) candidates.push(`Compared with nearby tier peers, the supporting résumé is thinner and needs another recorded separator.`);
  if (signals.overperformingResumeForCurrentTier) candidates.push(`Compared with the same tier, the raw score overperforms the label and makes the case more interesting than the tier alone suggests.`);
  return candidates.filter((sentence): sentence is string => sentence !== null).slice(0, 1)[0] ?? null;
}

function tierBCommentary(profile: LegacyProfile, category: LegacyCommentaryCategory, signals: LegacyComparativeSignals): string {
  const proof: string[] = [];
  if (profile.leagueWinsTotal > 0) proof.push(`${profile.leagueWinsTotal} recorded league ${profile.leagueWinsTotal === 1 ? "title" : "titles"}`);
  if (profile.globalChampionWins > 0) proof.push(`${profile.globalChampionWins} Global ${profile.globalChampionWins === 1 ? "title" : "titles"}`);
  if (profile.eliteCupWins > 0) proof.push(`${profile.eliteCupWins} Elite Cup ${profile.eliteCupWins === 1 ? "win" : "wins"}`);
  if (profile.longestWinStreakOverall >= 7) proof.push(`a ${profile.longestWinStreakOverall}-match winning streak`);
  if (profile.invincibleSplits > 0) proof.push(`${profile.invincibleSplits} complete invincible ${profile.invincibleSplits === 1 ? "split" : "splits"}`);
  if (profile.invincibleHinrunden > 0) proof.push(`${profile.invincibleHinrunden} invincible Hinrunde ${profile.invincibleHinrunden === 1 ? "run" : "runs"}`);
  if (profile.invincibleRueckrunden > 0) proof.push(`${profile.invincibleRueckrunden} invincible Rückrunde ${profile.invincibleRueckrunden === 1 ? "run" : "runs"}`);
  if (proof.length === 0) proof.push(`a ${legacyScore(profile)}-point résumé with ${profile.currentLeague} context`);
  const missing: string[] = [];
  if (profile.globalChampionWins === 0) missing.push("a Global League title");
  if (profile.eliteCupWins === 0) missing.push("an Elite Cup win");
  if (profile.invincibleSplits === 0) missing.push("a complete invincible split");
  if (profile.leagueWinsTotal < 2) missing.push("repeated title-level performance across completed splits");
  const voice = tierBProfile(profile);
  const proofLine = proof.slice(0, 3).join(proof.length > 2 ? ", " : " and ");
  const missingLine = missing.slice(0, 3).join(missing.length > 2 ? ", " : " or ");
  const path = profile.currentLeague !== "Global League"
    ? "moving that production into the Global League and backing it with a recorded trophy"
    : profile.leagueWinsTotal > 0
      ? "adding another completed-split title, an Elite Cup result, or an unbeaten split"
      : "turning the form marker into a recorded title, cup, or unbeaten split";
  const templates: Partial<Record<LegacyCommentary["voice"], string>> = {
    "Title traditionalist": `Tier B is the right shelf for ${profile.wrestler}: the title file shows ${proofLine}, but the championship ceiling is not proven enough yet. The missing Tier A/S proof is ${missingLine}; the fastest rewrite is ${path}.`,
    "Event prestige columnist": `${profile.wrestler} has a credible file, not yet an elite one, because the archive points to ${proofLine}. The missing separator is ${missingLine}, so a future Global title, Elite Cup run, or finals-level breakthrough would change the tone immediately.`,
    "Dominance analyst": `Tier B for ${profile.wrestler} begins with control: ${proofLine}. The missing step is not volume; it is proof at a higher level, especially ${missingLine}, with ${path} doing the most work for an upgrade.`,
    "Consistency historian": `${profile.wrestler}'s résumé has shape through ${proofLine}, which explains Tier B without stretching the evidence. To climb, the tracker needs ${missingLine}; repeated title-level splits would matter more than another ordinary stat line.`,
    "Upside / trajectory analyst": `Right now ${profile.wrestler} reads as an upward-moving Tier B story built on ${proofLine}. The story still lacks ${missingLine}, and ${path} is the achievement route that would make the next tier feel earned.`,
    "Skeptical résumé analyst": `Tier B is generous but defensible for ${profile.wrestler} because ${proofLine} is on record. Before Tier A or Tier S, the file needs ${missingLine}; until then, the tracker should resist treating promise as proof.`,
  };
  templates["Comparative peer analyst"] = `${profile.wrestler} sits in Tier B because the recorded file shows ${proofLine}, but the peer context matters as much as the row itself. ${comparativeSentence(profile, signals) ?? `The missing Tier A/S proof remains ${missingLine}, so the comparison cannot become a promotion without new recorded achievements.`}`;
  templates["Streak/value analyst"] = `${profile.wrestler} has value beyond the trophy count: ${proofLine}. ${comparativeSentence(profile, signals) ?? `That still needs ${missingLine} before it can be treated as an elite legacy case.`}`;
  const comparative = comparativeSentence(profile, signals);
  const tail = category === "Streak-Based Threat"
    ? "The streak is real evidence, but it is not counted as silverware."
    : "Every claim here stays tied to recorded fields only.";
  const baseText = templates[voice] ?? templates["Title traditionalist"] ?? "";
  const comparativeTail = comparative && !baseText.includes(comparative) ? `${comparative} ` : "";
  return `${baseText} ${comparativeTail}${tail}`.replace(/\s+/g, " ").trim();
}

export function generateLegacyCommentary(profile: LegacyProfile, peers: LegacyProfile[] = [profile]): LegacyCommentary {
  const signals = comparativeSignals(profile, peers);
  const category = topics(profile)[0].category;
  const tags = evidence(profile);
  const tier = profile.legacyTier ?? legacyTier(profile);
  const voice = tier === "B" ? tierBProfile(profile) : pick(profile, "voice", ["Title traditionalist", "Event prestige columnist", "Dominance analyst", "Streak/value analyst", "Consistency historian", "Skeptical résumé analyst", "Upside / trajectory analyst", "Comparative peer analyst"] as const);
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

  if (tier === "B") {
    const compact = tierBCommentary(profile, category, signals);
    return { voice, category, text: compact, excerpt: excerpt(compact), evidenceTags: tags, statCallouts: statCallouts(profile), feature: false };
  }

  if (tier !== "S" && tier !== "A") {
    const comparison = comparativeSentence(profile, signals);
    const compact = `${profile.wrestler} is currently a Tier ${tier} profile. The recorded row shows ${profile.leagueWinsTotal} league titles, ${profile.globalChampionWins} Global titles, ${profile.eliteCupWins} Elite Cup wins and a longest winning streak of ${profile.longestWinStreakOverall}; that is not enough for a full A/S feature column yet.${comparison ? ` ${comparison}` : ""}`;
    return { voice, category, text: compact, excerpt: excerpt(compact), evidenceTags: tags, statCallouts: statCallouts(profile), feature: false };
  }

  const main = pick(profile, `copy-${category}-${voice}`, primary[category]);
  const support = supportingSentence(profile, category);
  const comparison = comparativeSentence(profile, signals);
  const scoreLine = `On the deterministic legacy model, that produces Tier ${tier} from a ${legacyScore(profile)}-point résumé: ${profile.leagueWinsTotal} league titles, ${profile.globalChampionWins} Global titles, ${profile.eliteCupWins} Elite Cup wins, ${profile.doubles} doubles and a longest winning streak of ${profile.longestWinStreakOverall}.`;
  const perspective = voice === "Skeptical résumé analyst"
    ? `The cautious reading still has to respect the recorded evidence; the case is elevated by what is present, not by anything missing from the workbook.`
    : voice === "Event prestige columnist"
      ? `The event-night lens matters here, so cup production and title conversions carry more of the argument than reputation or table aesthetics.`
      : voice === "Dominance analyst"
        ? `Dominance markers such as invincible phases and streak length shape the tone, but only where the tracker actually records them.`
        : voice === "Consistency historian"
          ? `The value is not just the peak; it is how many separate recorded lines keep pointing back to top-end relevance.`
          : voice === "Upside / trajectory analyst"
            ? `The career arc is read through the current league context without pretending that movement achievements exist when the archive does not say so.`
            : voice === "Comparative peer analyst"
            ? `Peer context shapes the final read: the row is measured against the rest of the archive before the tier is explained.`
            : voice === "Streak/value analyst"
              ? `The value lens gives streaks and form markers weight without converting them into unrecorded trophies.`
              : `The title-traditionalist case begins with trophies and only then moves to supporting form notes.`;
  const text = [main, support, comparison, scoreLine, perspective].filter(Boolean).join(" ");
  return { voice, category, text, excerpt: excerpt(text), evidenceTags: tags, statCallouts: statCallouts(profile), feature: true };
}
