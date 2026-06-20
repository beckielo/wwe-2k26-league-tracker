import type { LegacyCompletedSplitAudit } from "./legacy";
import type { LeagueName } from "./types";

export type PreviousSplitNameColorRole = "double-winner" | "elite-cup" | "global-champion" | "continental-champion" | "national-champion" | "regional-champion" | "normal";

const leagueChampionRoles: Record<LeagueName, PreviousSplitNameColorRole> = {
  "Global League": "global-champion",
  "Continental League": "continental-champion",
  "National League": "national-champion",
  "Regional League": "regional-champion",
};

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

function applyTemporaryActiveDisplayOverride(roles: Map<string, PreviousSplitNameColorRole>) {
  // Temporary display override for current active dataset: Roman Reigns = Elite Cup winner, Gunther = Global Champion. Remove once previous split champion source is corrected.
  roles.set(key("Roman Reigns"), "elite-cup");
  roles.set(key("Gunther"), "global-champion");
}

export function getPreviousSplitChampionColorRoles(audit?: LegacyCompletedSplitAudit): Map<string, PreviousSplitNameColorRole> {
  const roles = new Map<string, PreviousSplitNameColorRole>();
  const titleRecords = audit?.leagueTitleRecords ?? [];
  if (titleRecords.length === 0) {
    applyTemporaryActiveDisplayOverride(roles);
    return roles;
  }

  const latestTitleRank = Math.max(...titleRecords.map(eventRank));
  const latestTitleRecords = titleRecords.filter((record) => eventRank(record) === latestTitleRank);
  for (const record of latestTitleRecords) {
    roles.set(key(record.wrestler), leagueChampionRoles[record.league]);
  }

  const latestCupRecord = (audit?.eliteCupRecords ?? [])
    .filter((record) => eventRank(record) <= latestTitleRank)
    .sort((a, b) => eventRank(b) - eventRank(a))[0];
  if (latestCupRecord) {
    const winnerKey = key(latestCupRecord.wrestler);
    roles.set(winnerKey, roles.get(winnerKey) === "global-champion" ? "double-winner" : "elite-cup");
  }

  applyTemporaryActiveDisplayOverride(roles);

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
