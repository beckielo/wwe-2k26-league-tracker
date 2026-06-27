import { describe, expect, it } from "vitest";
import { createChampionMetadataAudit, getLastCompletedAchievementMetadata, getLatestCompletedSplitRecord, getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import { refreshLastCompletedAchievementMetadata } from "@/domain/completed-split-reconciliation";
import type { CompletedSplitLegacyCommit, TrackerState } from "@/domain/tracker-state";

function commit(leagueYear: number, split: "Opening Split" | "Closing Split", suffix: string, options: Partial<CompletedSplitLegacyCommit> = {}): CompletedSplitLegacyCommit {
  return {
    sourceSignature: `completed-${leagueYear}-${split}-${suffix}`,
    committedAt: `2026-0${Math.min(leagueYear + 1, 9)}-${split === "Opening Split" ? "01" : "15"}T00:00:00.000Z`,
    leagueYear,
    split,
    titleRecords: [
      { league: "Global League", wrestler: `Global ${suffix}` },
      { league: "Continental League", wrestler: `Continental ${suffix}` },
      { league: "National League", wrestler: `National ${suffix}` },
      { league: "Regional League", wrestler: `Regional ${suffix}` },
    ],
    eliteCupWinner: `Cup ${suffix}`,
    eliteCupRunnerUp: `Runner ${suffix}`,
    ...options,
  };
}

function state(commits: CompletedSplitLegacyCommit[]): TrackerState {
  return { version: 1, confirmedResults: [], completedWeeks: [], lastExportedAt: null, lastImportedAt: null, completedSplitLegacyCommits: commits };
}

describe("Phase 19AG latest completed champion metadata rollforward", () => {
  it("selects newest completed split by league year and split chronology, not insertion order", () => {
    const y1Closing = commit(1, "Closing Split", "y1c");
    const y2Opening = commit(2, "Opening Split", "y2o");
    const y1Opening = commit(1, "Opening Split", "y1o");

    expect(getLatestCompletedSplitRecord([y1Closing, y2Opening, y1Opening])?.sourceSignature).toBe(y2Opening.sourceSignature);
    expect(getLatestCompletedSplitRecord([y1Closing, y1Opening])?.sourceSignature).toBe(y1Closing.sourceSignature);
  });

  it("rolls metadata forward after a second split and removes colors from stale champions", () => {
    const oldSplit = commit(1, "Opening Split", "old", { eliteCupWinner: "Global old" });
    const newSplit = commit(1, "Closing Split", "new");
    const metadata = getLastCompletedAchievementMetadata(state([newSplit, oldSplit]));
    const roles = getPreviousSplitChampionColorRoles(state([oldSplit, newSplit]));

    expect(metadata).toMatchObject({ globalChampion: "Global new", continentalChampion: "Continental new", nationalChampion: "National new", regionalChampion: "Regional new", eliteCupWinner: "Cup new", completedSplitSignature: newSplit.sourceSignature });
    expect(getPreviousSplitNameColorRole({ wrestler: "Global old", championRoles: roles })).toBe("normal");
    expect(getPreviousSplitNameColorRole({ wrestler: "Global new", championRoles: roles })).toBe("global-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Continental new", championRoles: roles })).toBe("continental-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "National new", championRoles: roles })).toBe("national-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Regional new", championRoles: roles })).toBe("regional-champion");
    expect(getPreviousSplitNameColorRole({ wrestler: "Cup new", championRoles: roles })).toBe("elite-cup");
  });

  it("only marks a double winner purple when the newest Global Champion also won that newest Elite Cup", () => {
    const oldSplit = commit(1, "Opening Split", "old", { eliteCupWinner: "Global old" });
    const newSplit = commit(1, "Closing Split", "new", { eliteCupWinner: "Global new" });
    const roles = getPreviousSplitChampionColorRoles(undefined, [oldSplit, newSplit]);

    expect(getPreviousSplitNameColorRole({ wrestler: "Global new", championRoles: roles })).toBe("double-winner");
    expect(getPreviousSplitNameColorRole({ wrestler: "Global old", championRoles: roles })).toBe("normal");
  });

  it("retroactively replaces stale stored metadata and exposes an audit without duplicating records", () => {
    const oldSplit = commit(1, "Opening Split", "old");
    const newSplit = commit(1, "Closing Split", "new");
    const stale = { ...state([oldSplit, newSplit]), activeWorkflow: { leagueYear: 2, split: "Opening Split" as const, yearWeek: 1, splitWeek: 1, scheduleSource: "accepted generated snapshot" as const, acceptedScheduleAt: "2026-03-01T00:00:00.000Z", activatedAt: "2026-03-01T00:00:00.000Z", userLeague: "Global League" as const }, lastCompletedAchievementMetadata: getLastCompletedAchievementMetadata([oldSplit]) };

    const repaired = refreshLastCompletedAchievementMetadata(stale);
    expect(repaired.completedSplitLegacyCommits).toHaveLength(2);
    expect(repaired.lastCompletedAchievementMetadata?.completedSplitSignature).toBe(newSplit.sourceSignature);
    expect(createChampionMetadataAudit(stale)).toMatchObject({ latestCompletedSplitSignature: newSplit.sourceSignature, storedMetadataSignature: oldSplit.sourceSignature, storedMetadataWasRefreshed: true, staleMetadataWasIgnored: true });
  });
});
