import type { LegacyCompletedSplitSource, LegacyEliteCupRecord } from "./legacy";

export const MANUAL_LEGACY_CORRECTION_SOURCE = "User-confirmed manual historical correction";

export const MANUAL_LEGACY_ELITE_CUP_CORRECTIONS: LegacyEliteCupRecord[] = [
  {
    leagueYear: 2,
    split: "Opening Split",
    eventName: "Global Elite Cup",
    wrestler: "Roman Reigns",
    sourceLabel: `${MANUAL_LEGACY_CORRECTION_SOURCE} — Phase 10.10.4; missing from automatic LY2 Opening Split Elite Cup source`,
  },
];

export const MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE: LegacyCompletedSplitSource = {
  source: MANUAL_LEGACY_CORRECTION_SOURCE,
  completedSplits: ["2:Opening Split"],
  eliteCupRecords: MANUAL_LEGACY_ELITE_CUP_CORRECTIONS,
  notes: [
    "Phase 10.10.4: user-confirmed LY2 Opening Split Global Elite Cup winner is Roman Reigns.",
    "Fallback correction only; deduplicated against automatic Elite Cup records by league year, split/event window, event identity, and winner.",
    "No other historical results are invented or altered.",
  ],
};
