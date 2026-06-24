import type { LegacyCompletedSplitAudit } from "./legacy";
import type { CompletedSplitLegacyCommit } from "./tracker-state";
import type { LeagueName } from "./types";

export type PreviousSplitNameColorRole = "double-winner" | "elite-cup" | "global-champion" | "continental-champion" | "national-champion" | "regional-champion" | "normal";

function normalizeLeagueName(value: string): LeagueName | null {
  const normalized = key(value)
    .replace(/\bchampion$/, "")
    .replace(/\btitle$/, "")
    .replace(/\bwinner$/, "")
    .trim()
    .replace(/ league$/, "")
    .trim();
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
  applyMetadataRoles(roles, commitToChampionMetadata(commit));
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
  return commitToChampionMetadata(latestCommit);
}

function commitToChampionMetadata(latestCommit: CompletedSplitLegacyCommit): LastCompletedSplitChampionMetadata {
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

function applyMetadataRoles(roles: Map<string, PreviousSplitNameColorRole>, metadata: Pick<LastCompletedSplitChampionMetadata, "globalChampion" | "continentalChampion" | "nationalChampion" | "regionalChampion" | "eliteCupWinner">): void {
  if (metadata.regionalChampion) roles.set(key(metadata.regionalChampion), "regional-champion");
  if (metadata.nationalChampion) roles.set(key(metadata.nationalChampion), "national-champion");
  if (metadata.continentalChampion) roles.set(key(metadata.continentalChampion), "continental-champion");
  if (metadata.globalChampion) roles.set(key(metadata.globalChampion), "global-champion");
  if (metadata.eliteCupWinner) {
    const winnerKey = key(metadata.eliteCupWinner);
    roles.set(winnerKey, roles.get(winnerKey) === "global-champion" ? "double-winner" : "elite-cup");
  }
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
  const latestCupRecord = (audit?.eliteCupRecords ?? [])
    .filter((record) => eventRank(record) <= latestTitleRank)
    .sort((a, b) => eventRank(b) - eventRank(a))[0];

  const champion = (league: LeagueName) => titleRecords
    .find((record) => eventRank(record) === latestTitleRank && normalizeLeagueName(record.league) === league)?.wrestler ?? null;
  applyMetadataRoles(roles, {
    globalChampion: champion("Global League"),
    continentalChampion: champion("Continental League"),
    nationalChampion: champion("National League"),
    regionalChampion: champion("Regional League"),
    eliteCupWinner: latestCupRecord?.wrestler ?? null,
  });

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
