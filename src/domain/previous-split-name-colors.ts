import type { LegacyCompletedSplitAudit } from "./legacy";
import type { CompletedSplitLegacyCommit } from "./tracker-state";
import type { LeagueName } from "./types";

export type PreviousSplitNameColorRole = "double-winner" | "elite-cup" | "global-champion" | "continental-champion" | "national-champion" | "regional-champion" | "normal";

const leagueChampionRoles: Record<LeagueName, PreviousSplitNameColorRole> = {
  "Global League": "global-champion",
  "Continental League": "continental-champion",
  "National League": "national-champion",
  "Regional League": "regional-champion",
};

function normalizeLeagueName(value: string): LeagueName | null {
  const normalized = key(value).replace(/ league$/, "");
  if (normalized === "global") return "Global League";
  if (normalized === "continental") return "Continental League";
  if (normalized === "national") return "National League";
  if (normalized === "regional") return "Regional League";
  return null;
}

function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function splitRank(split: string): number {
  if (split === "Closing Split") return 2;
  if (split === "Opening Split") return 1;
  return 0;
}

function eventRank(record: { leagueYear: number; split: string | { toString(): string } }): number {
  return record.leagueYear * 10 + splitRank(String(record.split));
}

function applyCommitRoles(roles: Map<string, PreviousSplitNameColorRole>, commit: CompletedSplitLegacyCommit) {
  for (const record of commit.titleRecords) {
    const league = normalizeLeagueName(record.league);
    if (!league) continue;
    roles.set(key(record.wrestler), leagueChampionRoles[league]);
  }
  if (commit.eliteCupWinner) {
    const winnerKey = key(commit.eliteCupWinner);
    roles.set(winnerKey, roles.get(winnerKey) === "global-champion" ? "double-winner" : "elite-cup");
  }
}


export interface LastCompletedSplitChampionMetadata {
  leagueYear: number;
  split: string;
  sourceSignature: string;
  globalChampion: string | null;
  continentalChampion: string | null;
  nationalChampion: string | null;
  regionalChampion: string | null;
  eliteCupWinner: string | null;
  eliteCupRunnerUp: string | null;
}

export function getLastCompletedSplitChampionMetadata(commits: CompletedSplitLegacyCommit[] = []): LastCompletedSplitChampionMetadata | null {
  const latestCommit = [...commits].sort((a, b) => (b.leagueYear * 10 + splitRank(b.split)) - (a.leagueYear * 10 + splitRank(a.split)))[0];
  if (!latestCommit) return null;
  const champion = (league: LeagueName) => latestCommit.titleRecords.find((record) => normalizeLeagueName(record.league) === league)?.wrestler ?? null;
  return {
    leagueYear: latestCommit.leagueYear,
    split: latestCommit.split,
    sourceSignature: latestCommit.sourceSignature,
    globalChampion: champion("Global League"),
    continentalChampion: champion("Continental League"),
    nationalChampion: champion("National League"),
    regionalChampion: champion("Regional League"),
    eliteCupWinner: latestCommit.eliteCupWinner ?? null,
    eliteCupRunnerUp: latestCommit.eliteCupRunnerUp ?? null,
  };
}

export function getLastCompletedAchievementMetadata(commits: CompletedSplitLegacyCommit[] = []): LastCompletedSplitChampionMetadata | null {
  return getLastCompletedSplitChampionMetadata(commits);
}

export function getPreviousSplitChampionColorRoles(audit?: LegacyCompletedSplitAudit, commits: CompletedSplitLegacyCommit[] = []): Map<string, PreviousSplitNameColorRole> {
  const roles = new Map<string, PreviousSplitNameColorRole>();
  const latestCommit = [...commits].sort((a, b) => (b.leagueYear * 10 + splitRank(b.split)) - (a.leagueYear * 10 + splitRank(a.split)))[0];
  if (latestCommit) {
    applyCommitRoles(roles, latestCommit);
    return roles;
  }
  const titleRecords = audit?.leagueTitleRecords ?? [];
  if (titleRecords.length === 0) {
    return roles;
  }

  const latestTitleRank = Math.max(...titleRecords.map(eventRank));
  const latestTitleRecords = titleRecords.filter((record) => eventRank(record) === latestTitleRank);
  for (const record of latestTitleRecords) {
    const league = normalizeLeagueName(record.league);
    if (!league) continue;
    roles.set(key(record.wrestler), leagueChampionRoles[league]);
  }

  const latestCupRecord = (audit?.eliteCupRecords ?? [])
    .filter((record) => eventRank(record) <= latestTitleRank)
    .sort((a, b) => eventRank(b) - eventRank(a))[0];
  if (latestCupRecord) {
    const winnerKey = key(latestCupRecord.wrestler);
    roles.set(winnerKey, roles.get(winnerKey) === "global-champion" ? "double-winner" : "elite-cup");
  }

  return roles;
}

export function getPreviousSplitNameColorRole(input: {
  wrestler: string;
  championRoles?: Map<string, PreviousSplitNameColorRole>;
  audit?: LegacyCompletedSplitAudit;
}): PreviousSplitNameColorRole {
  const roles = input.championRoles ?? getPreviousSplitChampionColorRoles(input.audit);
  return roles.get(key(input.wrestler)) ?? "normal";
}
