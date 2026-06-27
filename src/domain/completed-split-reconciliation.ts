import type { LeagueFinalsResult } from "./league-finals";
import { LEAGUE_NAMES } from "./types";
import type { CompletedSplitLegacyCommit, TrackerState } from "./tracker-state";
import { createChampionMetadataAudit, getLastCompletedAchievementMetadata } from "./previous-split-name-colors";

function slug(value: string | null | undefined): string {
  return `${value ?? ""}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function canonicalResultIds(results: LeagueFinalsResult[] = []): string[] {
  return results.map((result) => `${result.matchId}:${result.resultType}:${result.winner ?? ""}:${result.matchIdentity ?? ""}`).sort();
}

function eliteCupFinalResult(results: LeagueFinalsResult[] = []): LeagueFinalsResult | undefined {
  return results.find((result) => result.matchId === "league-finals:night-two:match-6" || result.matchIdentity?.includes(":elite-cup-final:"));
}

function participantsFromMatchIdentity(result: LeagueFinalsResult | undefined, results: LeagueFinalsResult[] = []): string[] {
  if (result?.matchIdentity) {
    const parts = result.matchIdentity.split(":");
    if (parts.length >= 8 && parts[2] === "elite-cup-final") {
      const participants = parts.slice(6, 8).filter((part) => part && part !== "unresolved");
      if (participants.length) return participants;
    }
  }
  return ["league-finals:night-two:match-4", "league-finals:night-two:match-5"]
    .map((matchId) => results.find((candidate) => candidate.matchId === matchId)?.winner)
    .filter((winner): winner is string => Boolean(winner));
}

function wrestlerBySlug(state: TrackerState): Map<string, string> {
  const assignments = LEAGUE_NAMES.flatMap((league) => state.acceptedPostFinalsComposition?.rosters[league] ?? []);
  return new Map(assignments.map((assignment) => [slug(assignment.wrestler), assignment.wrestler]));
}

export function buildCompletedSplitLegacyCommitFromState(state: TrackerState, committedAt = new Date().toISOString()): CompletedSplitLegacyCommit | null {
  const accepted = state.acceptedPostFinalsComposition;
  if (!accepted?.postFinalsCompositionAccepted) return null;
  if (!state.activeWorkflow && !state.postFinalsTransitionCompleted) return null;
  if (!state.completedFinalsNights?.some((entry) => entry.night === "Night One") || !state.completedFinalsNights?.some((entry) => entry.night === "Night Two")) return null;
  const titleRecords = LEAGUE_NAMES.flatMap((league) => {
    const champion = LEAGUE_NAMES.flatMap((candidateLeague) => accepted.rosters[candidateLeague]).find((assignment) => assignment.priorLeague === league && assignment.priorRank === 1);
    return champion ? [{ league, wrestler: champion.wrestler }] : [];
  });
  if (titleRecords.length !== 4) return null;
  const final = eliteCupFinalResult(state.leagueFinalsResults);
  if (!final || final.resultType !== "Winner" || !final.winner) return null;
  const bySlug = wrestlerBySlug(state);
  const participants = participantsFromMatchIdentity(final, state.leagueFinalsResults).map((participant) => bySlug.get(participant) ?? participant);
  const eliteCupRunnerUp = participants.find((participant) => participant !== final.winner) ?? null;
  const directPromotions = accepted.movementSummary.directMovements
    .filter((assignment) => assignment.movement === "Champion/direct promotion")
    .map((assignment) => ({ wrestler: assignment.wrestler, from: assignment.priorLeague, to: assignment.newLeague }));
  const directRelegations = accepted.movementSummary.directMovements
    .filter((assignment) => assignment.movement === "Direct relegation")
    .map((assignment) => ({ wrestler: assignment.wrestler, from: assignment.priorLeague, to: assignment.newLeague }));
  const relegationPlayoffWinners = accepted.movementSummary.playoffMovements
    .filter((assignment) => assignment.movement === "Promoted" || assignment.movement === "Retained higher league")
    .map((assignment) => ({ wrestler: assignment.wrestler }));
  const relegationPlayoffLosers = accepted.movementSummary.playoffMovements
    .filter((assignment) => assignment.movement === "Relegated" || assignment.movement === "Failed promotion")
    .map((assignment) => ({ wrestler: assignment.wrestler }));
  const signaturePayload = [
    accepted.leagueYear,
    accepted.split,
    accepted.sourceSignature,
    ...titleRecords.map((record) => `${record.league}=${record.wrestler}`),
    `elite=${final.winner}`,
    `runnerUp=${eliteCupRunnerUp ?? ""}`,
    ...canonicalResultIds(state.leagueFinalsResults),
  ].join("|");
  return {
    sourceSignature: `completed-split:${accepted.leagueYear}:${accepted.split}:${accepted.sourceSignature}:${slug(signaturePayload)}`,
    committedAt,
    leagueYear: accepted.leagueYear,
    split: accepted.split,
    titleRecords,
    eliteCupWinner: final.winner,
    eliteCupRunnerUp,
    directPromotions,
    directRelegations,
    relegationPlayoffWinners,
    relegationPlayoffLosers,
  };
}

export function reconcileCompletedSplitHistory(state: TrackerState, committedAt?: string): TrackerState {
  const commit = buildCompletedSplitLegacyCommitFromState(state, committedAt);
  if (!commit) return refreshLastCompletedAchievementMetadata(state);
  const existing = state.completedSplitLegacyCommits ?? [];
  const alreadyCommitted = existing.some((candidate) => candidate.sourceSignature === commit.sourceSignature)
    || existing.some((candidate) => candidate.leagueYear === commit.leagueYear && candidate.split === commit.split && candidate.titleRecords.length === 4 && candidate.eliteCupWinner === commit.eliteCupWinner);
  if (alreadyCommitted) return refreshLastCompletedAchievementMetadata(state);
  return refreshLastCompletedAchievementMetadata({ ...state, completedSplitLegacyCommits: [...existing, commit] });
}

export function refreshLastCompletedAchievementMetadata(state: TrackerState): TrackerState {
  const latest = getLastCompletedAchievementMetadata(state);
  const audit = createChampionMetadataAudit(state);
  if (!latest) return { ...state, lastCompletedAchievementMetadata: null, championMetadataAudit: audit };
  const currentSignature = state.lastCompletedAchievementMetadata?.completedSplitSignature ?? state.lastCompletedAchievementMetadata?.sourceSignature ?? null;
  if (currentSignature === latest.completedSplitSignature && state.championMetadataAudit?.latestCompletedSplitSignature === latest.completedSplitSignature) return state;
  return { ...state, lastCompletedAchievementMetadata: latest, championMetadataAudit: audit };
}

export function getCompletedSplitReconciliationDiagnostics(state: TrackerState) {
  const commit = buildCompletedSplitLegacyCommitFromState(state, "diagnostic");
  return {
    completedSplitSignature: commit?.sourceSignature ?? null,
    committedOverlayExists: Boolean(commit && (state.completedSplitLegacyCommits ?? []).some((entry) => entry.sourceSignature === commit.sourceSignature)),
    leagueTitleOverlayCount: (state.completedSplitLegacyCommits ?? []).reduce((sum, entry) => sum + entry.titleRecords.length, 0),
    eliteCupOverlayCount: (state.completedSplitLegacyCommits ?? []).filter((entry) => entry.eliteCupWinner).length,
    lastCompletedGlobalChampion: commit?.titleRecords.find((record) => record.league === "Global League")?.wrestler ?? null,
    lastCompletedEliteCupWinner: commit?.eliteCupWinner ?? null,
  };
}
