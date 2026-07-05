import "server-only";

import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { validateTrackerData } from "@/domain/validation";
import { buildCurrentStandingsFromScheduleComposition, buildLeaguesFromStandings, validateCurrentLeagueComposition } from "@/domain/current-league-composition";
import { parseAppWorkbookBaseline } from "@/domain/app-workbook-baseline";
import {
  buildWorkflowContextBaseline,
  createAppWorkbookContextCandidate,
  createDashboardContextCandidate,
} from "@/domain/workflow-context";
import {
  deriveCurrentHistoricalAnalytics,
  historicalAnalyticsSheetStatus,
  type HistoricalAnalyticsAudit,
} from "@/domain/historical-analytics";
import { ACCEPTED_SCHEDULE_SHEET } from "@/domain/workbook-writeback";
import { buildPrecedingSplitHistory } from "@/domain/completed-split-history";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE, MANUAL_LEGACY_ELITE_CUP_CORRECTIONS } from "@/domain/legacy-manual-corrections";
import { auditLegacyCompletedSplitSources, applyLegacyHistoryRecords, applyManualEliteCupDisplayPatch, enrichLegacyProfilesFromCurrentMaster, enrichLegacyProfilesWithCompletedSplitChampions, extractCompletedEliteCupRecordsFromFinalStandings, extractCompletedSplitTitleRecordsFromFinalStandings, legacyProfileEliteCupRecords, parseLegacyTracker, summarizeLegacyProfiles, type LegacyTableData } from "@/domain/legacy";
import {
  LEAGUE_NAMES,
  type HeadToHeadRecord,
  type League,
  type LeagueName,
  type Match,
  type MatchResult,
  type MatchupReferenceRow,
  type RoundType,
  type SplitName,
  type StandingRow,
  type StreakRecord,
  type TrackerData,
  type ValidationIssue,
  type Week,
} from "@/domain/types";

const SOURCE_DIR = path.join(process.cwd(), "source-docs");
const PREFERRED_MASTER = path.join(SOURCE_DIR, "current-master.xlsx");

function findMasterWorkbook(): string {
  if (fs.existsSync(PREFERRED_MASTER)) return PREFERRED_MASTER;
  const candidates = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.toLowerCase().endsWith(".xlsx"))
    .filter((name) => name.includes("source-docs-current-master"));
  if (candidates.length !== 1) {
    throw new Error(`Expected one current master workbook, found ${candidates.length}.`);
  }
  return path.join(SOURCE_DIR, candidates[0]);
}

export function loadMasterWorkbookBuffer(): { buffer: Buffer; sourceFile: string } {
  const workbookPath = findMasterWorkbook();
  return {
    buffer: fs.readFileSync(workbookPath),
    sourceFile: path.basename(workbookPath),
  };
}

export function loadLegacyTableData(): LegacyTableData & {
  sourceFile: string;
  sourceSheet: "Legacy_Tracker";
  historicalAnalytics: HistoricalAnalyticsAudit;
} {
  const workbookPath = findMasterWorkbook();
  const sourceFile = path.basename(workbookPath);
  const workbook = XLSX.read(fs.readFileSync(workbookPath), { type: "buffer", cellDates: false });
  const tracker = loadTrackerData();
  const legacy = parseLegacyTracker(workbook);
  const standings = workbook.Sheets.Standings_Current
    ? XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets.Standings_Current, { defval: null, raw: true }).map((row) => ({
      league: league(row.League),
      rank: number(row.Rank),
      wrestler: text(row.Wrestler),
      seed: number(row.Seed),
      matches: number(row.Matches),
      wins: number(row.Wins),
      draws: number(row.Draws),
      losses: number(row.Losses),
      points: number(row.Points),
      status: text(row["Status / Zone"]),
    }))
    : [];
  const dashboard = readDashboard(workbook);
  const leagueYearLabel = dashboard.get("WWE 2K26 Liga-System") || tracker.meta.leagueYearLabel;
  const currentSplit = tracker.meta.currentSplit;
  const currentProfiles = enrichLegacyProfilesFromCurrentMaster(
    legacy.profiles,
    tracker.standings,
    tracker.streaks,
  );
  const explicitCompletedStandings = standings.every((row) => row.matches >= 22)
    && /finals|post-finals|abgeschlossen/i.test(
      `${dashboard.get("League Finals") ?? ""} ${dashboard.get("Ligaphase") ?? ""} ${dashboard.get("Aktueller Stand") ?? ""}`,
    );
  const finalStandingHistory = explicitCompletedStandings
    ? extractCompletedSplitTitleRecordsFromFinalStandings(
      standings,
      parseLeagueYear(leagueYearLabel),
      currentSplit,
      "Current master final standings",
    )
    : { titleRecords: [], warnings: [] };
  const finalEliteCupHistory = finalStandingHistory.titleRecords.length === 4
    ? extractCompletedEliteCupRecordsFromFinalStandings(
      standings,
      parseLeagueYear(leagueYearLabel),
      currentSplit,
      "Current master final Elite Cup status",
    )
    : { eliteCupRecords: [], warnings: [] };
  const completedSplits = [
    "1:Historical Split",
    ...(finalStandingHistory.titleRecords.length === 4
      ? [`${parseLeagueYear(leagueYearLabel)}:${currentSplit}`]
      : []),
  ];
  const audit = auditLegacyCompletedSplitSources([
    { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], eliteCupRecords: legacyProfileEliteCupRecords(legacy.profiles), notes: [`Legacy_Tracker profile totals: ${legacy.summary.leagueTitleRecords} league title records, ${legacy.summary.eliteCupRecords} Elite Cup records.`] },
    { source: "Post-Finals/final standings", completedSplits: finalStandingHistory.titleRecords.length === 4 ? [`${parseLeagueYear(leagueYearLabel)}:${currentSplit}`] : [], titleRecords: finalStandingHistory.titleRecords, notes: finalStandingHistory.warnings },
    { source: "League Finals records", completedSplits, eliteCupRecords: finalEliteCupHistory.eliteCupRecords, notes: finalEliteCupHistory.warnings.length ? finalEliteCupHistory.warnings : ["Recovered completed Elite Cup winner from finalized Global League Champion + Elite Cup status when Legacy_Tracker was incomplete."] },
    { source: "App database/history records", completedSplits, notes: ["Checked workbook app-state sheets; active Closing Split records are not counted as completed history."] },
    MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
  ]);
  const profilesWithTitles = applyLegacyHistoryRecords(
    finalStandingHistory.titleRecords.length === 4 ? enrichLegacyProfilesWithCompletedSplitChampions(currentProfiles, standings) : currentProfiles,
    finalStandingHistory.titleRecords,
    audit.eliteCupRecords,
  );
  const summary = summarizeLegacyProfiles(profilesWithTitles, audit);
  const displayPatch = applyManualEliteCupDisplayPatch(profilesWithTitles, summary);
  return {
    ...legacy,
    policyNote: "",
    profiles: displayPatch.profiles,
    summary: displayPatch.summary,
    sourceFile,
    sourceSheet: "Legacy_Tracker",
    historicalAnalytics: tracker.historicalAnalytics,
  };
}

type CellValue = string | number | boolean | null | undefined;
type SheetRow = Record<string, CellValue>;

function readRows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Required workbook sheet is missing: ${sheetName}`);
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: true });
}

function text(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: CellValue): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected number, received ${String(value)}.`);
  return parsed;
}

function league(value: CellValue): LeagueName {
  const parsed = text(value);
  if (!LEAGUE_NAMES.includes(parsed as LeagueName)) throw new Error(`Unknown league: ${parsed}`);
  return parsed as LeagueName;
}

function split(value: CellValue): SplitName {
  const parsed = text(value);
  if (parsed !== "Opening Split" && parsed !== "Closing Split") {
    throw new Error(`Unknown split: ${parsed}`);
  }
  return parsed;
}

function roundType(value: CellValue): RoundType {
  const parsed = text(value);
  if (parsed.includes("Rückrunde")) return "Rückrunde";
  if (parsed.includes("Hinrunde")) return "Hinrunde";
  if (parsed.includes("Tiebreaker")) return "Tiebreaker";
  if (parsed.includes("League Finals")) return "League Finals";
  throw new Error(`Unknown round type: ${parsed}`);
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function matchSemanticKey(match: Pick<Match, "leagueYear" | "split" | "week" | "league" | "matchNumber">): string {
  return [
    match.leagueYear,
    match.split,
    match.week,
    match.league,
    match.matchNumber,
  ].join("|");
}

function readDashboard(workbook: XLSX.WorkBook): Map<string, string> {
  const sheet = workbook.Sheets.Dashboard;
  if (!sheet) throw new Error("Required workbook sheet is missing: Dashboard");
  const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, defval: null, raw: true });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.length >= 2) map.set(text(row[0]), text(row[1]));
  }
  return map;
}

function parseLeagueYear(label: string): number {
  const match = label.match(/League Year\s+(\d+)/i);
  if (!match) throw new Error(`Cannot parse league year from ${label}.`);
  return Number(match[1]);
}

function parseCurrentWeek(status: string): number {
  const match = status.match(/Woche\s+(\d+)/i);
  if (!match) throw new Error(`Cannot parse current week from ${status}.`);
  return Number(match[1]);
}

function workbookWarnings(workbook: XLSX.WorkBook, sourceFile: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = [
    {
      code: "MATCH_STIPULATION_UNKNOWN",
      severity: "warning",
      message: "Normal league match stipulation is not defined in the current sources.",
    },
    {
      code: "SPECIAL_FINISH_ENCODING_UNKNOWN",
      severity: "warning",
      message: "Draw, DQ, and no-contest workbook encoding is not demonstrated by current results.",
    },
    {
      code: "STATUS_FINALITY_UNKNOWN",
      severity: "warning",
      message: "Standings zone labels are shown as source values; clinched versus provisional status is not encoded.",
    },
  ];

  const rangeChecks = [
    ["H2H_Tracker", "A1:G265"],
    ["Changelog", "A1:D5"],
  ] as const;
  for (const [sheetName, knownTableRange] of rangeChecks) {
    const ref = workbook.Sheets[sheetName]?.["!ref"];
    if (ref && XLSX.utils.decode_range(ref).e.r > XLSX.utils.decode_range(knownTableRange).e.r) {
      warnings.push({
        code: "NAMED_TABLE_RANGE_DRIFT",
        severity: "warning",
        message: `${sheetName} contains populated rows beyond its named table range; populated worksheet rows were imported.`,
        source: { file: sourceFile, sheet: sheetName },
      });
    }
  }
  return warnings;
}

export function loadTrackerData(): TrackerData {
  const workbookPath = findMasterWorkbook();
  const sourceFile = path.basename(workbookPath);
  const workbook = XLSX.read(fs.readFileSync(workbookPath), { type: "buffer", cellDates: false });
  const dashboard = readDashboard(workbook);
  const leagueYearLabel = dashboard.get("WWE 2K26 Liga-System") || "League Year 2";
  const currentStatus = dashboard.get("Aktueller Stand") || "";
  const currentSplit = (leagueYearLabel.includes("Closing") ? "Closing Split" : "Opening Split") as SplitName;
  const leagueYear = parseLeagueYear(leagueYearLabel);
  const currentWeek = parseCurrentWeek(currentStatus);

  const memberships = readRows(workbook, "Roster_Seeds").map((row) => ({
    league: league(row.League),
    seed: number(row.Seed),
    name: text(row.Wrestler),
    startStatus: text(row.Startstatus) || null,
  }));

  const showDays: Record<LeagueName, League["showDay"]> = {
    "Global League": "Freitag",
    "Continental League": "Mittwoch",
    "National League": "Dienstag",
    "Regional League": "Montag",
  };

  const leagues: League[] = LEAGUE_NAMES.map((name) => ({
    id: slug(name),
    name,
    showDay: showDays[name],
    wrestlers: memberships
      .filter((membership) => membership.league === name)
      .sort((a, b) => a.seed - b.seed)
      .map((membership) => ({
        wrestler: { id: slug(membership.name), name: membership.name },
        seed: membership.seed,
        startStatus: membership.startStatus,
      })),
  }));

  const weeks: Week[] = readRows(workbook, "Year_Calendar_48W").map((row) => {
    const phase = text(row["Split Phase"]);
    const splitName: SplitName = phase.startsWith("Opening") ? "Opening Split" : "Closing Split";
    const splitWeek = number(row["League Week"]);
    return {
      leagueYear,
      yearWeek: number(row["Year Week"]),
      split: splitName,
      splitWeek,
      roundType: splitWeek <= 11 ? "Hinrunde" : splitWeek <= 22 ? "Rückrunde" : splitWeek === 23 ? "Tiebreaker" : "League Finals",
      purpose: text(row["Main Purpose"]),
    };
  });

  const scheduleRows = readRows(workbook, "Schedule_22W");
  const workbookMatches: Match[] = scheduleRows.map((row, index) => {
    const matchLeague = league(row.League);
    const matchWeek = number(row.Week);
    const wrestlerA = text(row["Wrestler A"]);
    const wrestlerB = text(row["Wrestler B"]);
    const matchNumber = number(row["Match #"]);
    const winner = text(row.Winner);
    return {
      id: `${slug(matchLeague)}-${matchWeek}-${matchNumber}`,
      leagueYear: parseLeagueYear(text(row["League Year"])),
      split: split(row.Split),
      week: matchWeek,
      roundType: roundType(row["Round Type"]),
      league: matchLeague,
      showDay: text(row["Show Day"]) as League["showDay"],
      matchNumber,
      wrestlerA,
      wrestlerB,
      matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "),
      status: winner ? "completed" : "scheduled",
      source: { file: sourceFile, sheet: "Schedule_22W", row: index + 2 },
    };
  });

  const appScheduleRows = workbook.Sheets[ACCEPTED_SCHEDULE_SHEET]
    ? XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[ACCEPTED_SCHEDULE_SHEET], { defval: null, raw: true })
    : [];
  const appScheduleMatches: Match[] = appScheduleRows.map((row, index) => {
    const wrestlerA = text(row.wrestlerA);
    const wrestlerB = text(row.wrestlerB);
    return {
      id: text(row.matchId),
      leagueYear: number(row.leagueYear),
      split: split(row.split),
      week: number(row.yearWeek),
      roundType: roundType(row.roundType),
      league: league(row.league),
      showDay: text(row.showDay) as League["showDay"],
      matchNumber: number(row.matchNumber),
      wrestlerA,
      wrestlerB,
      matchupKey: text(row.matchupKey) || [wrestlerA, wrestlerB].sort().join("::"),
      status: "scheduled",
      source: { file: sourceFile, sheet: ACCEPTED_SCHEDULE_SHEET, row: index + 2 },
    };
  });
  const appMatchBySemanticKey = new Map(
    appScheduleMatches.map((match) => [matchSemanticKey(match), match]),
  );
  const matches = [
    ...workbookMatches.filter((match) => !appMatchBySemanticKey.has(matchSemanticKey(match))),
    ...appScheduleMatches,
  ];

  const matchById = new Map(matches.map((match) => [match.id, match]));
  const workbookMatchById = new Map(workbookMatches.map((match) => [match.id, match]));
  const results: MatchResult[] = scheduleRows.flatMap((row, index) => {
    const winner = text(row.Winner);
    const matchLeague = league(row.League);
    const legacyMatchId = `${slug(matchLeague)}-${number(row.Week)}-${number(row["Match #"])}`;
    const legacyMatch = workbookMatchById.get(legacyMatchId);
    if (!legacyMatch) throw new Error(`Result has no scheduled match: ${legacyMatchId}`);
    const match = appMatchBySemanticKey.get(matchSemanticKey(legacyMatch)) ?? legacyMatch;
    const notes = text(row.Notes);
    const encodedOutcome = /^draw\b/i.test(notes)
      ? "draw"
      : /^no contest\b/i.test(notes)
        ? "no-contest"
        : winner
          ? "decisive"
          : null;
    if (!encodedOutcome) return [];
    const loser = encodedOutcome === "decisive"
      ? (winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA)
      : null;
    const sourceValue = text(row["Result Type"]);
    return [{
      matchId: match.id,
      outcome: encodedOutcome,
      winner: encodedOutcome === "decisive" ? winner : null,
      loser,
      resultSource: sourceValue === "User" || sourceValue === "Simulation" ? sourceValue : "Unknown",
      notes: notes || null,
      source: { file: sourceFile, sheet: "Schedule_22W", row: index + 2 },
    }];
  });

  const workbookStandings: StandingRow[] = readRows(workbook, "Standings_Current").map((row) => ({
    league: league(row.League),
    rank: number(row.Rank),
    wrestler: text(row.Wrestler),
    seed: number(row.Seed),
    matches: number(row.Matches),
    wins: number(row.Wins),
    draws: number(row.Draws),
    losses: number(row.Losses),
    points: number(row.Points),
    status: text(row["Status / Zone"]),
  }));

  const workbookHeadToHead: HeadToHeadRecord[] = readRows(workbook, "H2H_Tracker")
    .filter((row) => text(row.League))
    .map((row) => ({
    league: league(row.League),
    week: number(row.Week),
    roundType: roundType(row["Round Type"]),
    wrestlerA: text(row["Wrestler A"]),
    wrestlerB: text(row["Wrestler B"]),
    winner: text(row.Winner),
    loser: text(row.Loser),
    }));

  const workbookStreaks: StreakRecord[] = readRows(workbook, "Winning_Streaks")
    .filter((row) => text(row.League))
    .map((row) => ({
    league: league(row.League),
    wrestler: text(row.Wrestler),
    seed: number(row.Seed),
    currentStreak: number(row["Current Streak"]),
    longestWinningStreak: number(row["Longest Winning Streak"]),
    lastResult: text(row["Last Result"]) as StreakRecord["lastResult"],
    notes: text(row.Notes) || null,
    }));

  const matchupReference: MatchupReferenceRow[] = readRows(workbook, "Matchup_Reference").map((row) => ({
    week: number(row.Week),
    roundType: roundType(row.Phase),
    league: league(row.League),
    showDay: text(row["Show Day"]) as League["showDay"],
    matchNumber: number(row["Match #"]),
    wrestlerA: text(row["Wrestler A"]),
    wrestlerB: text(row["Wrestler B"]),
    matchupKey: text(row["Matchup Key"]),
    sourceLabel: text(row.Source),
    status: text(row["Status / Use"]),
  }));
  const appBaseline = parseAppWorkbookBaseline(workbook, matches);
  const dashboardContext = createDashboardContextCandidate({
    leagueYear,
    split: currentSplit,
    completedThroughYearWeek: currentWeek,
    schedule: workbookMatches,
    standings: workbookStandings,
  });
  const appContext = createAppWorkbookContextCandidate({
    latestWriteback: appBaseline.latestWriteback,
    schedule: matches,
    standings: appBaseline.standings,
    results: appBaseline.confirmedResults,
  });
  const useAppCheckpoint = Boolean(appContext?.valid);
  const authoritativeMatches = useAppCheckpoint ? matches : workbookMatches;
  const workflowContext = buildWorkflowContextBaseline({
    dashboard: dashboardContext,
    appWorkbook: appContext,
    dashboardSchedule: authoritativeMatches,
  });
  const selectedContext = useAppCheckpoint ? appContext! : dashboardContext;
  const baselineStandings = useAppCheckpoint ? appBaseline.standings! : workbookStandings;
  const acceptedAppResults = useAppCheckpoint ? appBaseline.confirmedResults : [];
  const appMatchResults: MatchResult[] = acceptedAppResults.map((result) => {
    const match = matchById.get(result.matchId);
    const loser = result.resultType === "Winner" && result.winner && match
      ? (result.winner === match.wrestlerA ? match.wrestlerB : match.wrestlerA)
      : null;
    return {
      matchId: result.matchId,
      outcome: result.resultType === "Winner" ? "decisive" : result.resultType === "Draw" ? "draw" : "no-contest",
      winner: result.winner,
      loser,
      resultSource: result.source,
      notes: null,
      source: { file: sourceFile, sheet: "App_Confirmed_Results" },
    };
  });
  const appResultIds = new Set(appMatchResults.map((result) => result.matchId));
  const workbookBackedResults = [
    ...results.filter((result) => !appResultIds.has(result.matchId)),
    ...appMatchResults,
  ];
  const currentCompositionStandings = buildCurrentStandingsFromScheduleComposition(
    baselineStandings,
    authoritativeMatches,
    workbookBackedResults,
    selectedContext.split,
  );
  const standings = useAppCheckpoint ? baselineStandings : (currentCompositionStandings ?? baselineStandings);
  const activeLeagues = currentCompositionStandings ? buildLeaguesFromStandings(standings, leagues) : leagues;
  const currentHistoricalAnalytics = deriveCurrentHistoricalAnalytics({
    matches: authoritativeMatches,
    results: workbookBackedResults,
    standings,
    leagueYear: selectedContext.leagueYear,
    split: selectedContext.split,
    completedThroughYearWeek: selectedContext.completedThroughYearWeek,
    authoritySourceSignature: selectedContext.sourceSignature,
  });
  const analyticsSheetStatus = historicalAnalyticsSheetStatus(
    workbookHeadToHead,
    workbookStreaks,
    currentHistoricalAnalytics,
  );
  const historicalAnalytics: HistoricalAnalyticsAudit = {
    ...currentHistoricalAnalytics.context,
    ...analyticsSheetStatus,
  };
  const confirmedOpeningEliteCup = MANUAL_LEGACY_ELITE_CUP_CORRECTIONS.find((record) => (
    record.leagueYear === 2 && record.split === "Opening Split" && record.wrestler
  ));
  const completedSplitHistory = buildPrecedingSplitHistory({
    currentContext: selectedContext,
    sourceWorkbook: sourceFile,
    confirmedEliteCupWinner: confirmedOpeningEliteCup ? {
      leagueYear: confirmedOpeningEliteCup.leagueYear,
      split: "Opening Split",
      wrestler: confirmedOpeningEliteCup.wrestler,
      source: confirmedOpeningEliteCup.sourceLabel ?? "User-confirmed historical correction",
    } : undefined,
  });
  const historicalAnalyticsIssues: ValidationIssue[] = [
    ...(analyticsSheetStatus.headToHeadSheetStatus === "reconstructed" ? [{
      code: "HISTORICAL_ANALYTICS_H2H_RECONSTRUCTED",
      severity: "warning" as const,
      message: "H2H_Tracker did not match the validated workflow context. The app reconstructed current head-to-head data from accepted schedule results.",
      source: { file: sourceFile, sheet: "H2H_Tracker" },
    }] : []),
    ...(analyticsSheetStatus.winningStreakSheetStatus === "reconstructed" ? [{
      code: "HISTORICAL_ANALYTICS_STREAKS_RECONSTRUCTED",
      severity: "warning" as const,
      message: "Winning_Streaks did not match the validated workflow context. The app reconstructed current streaks from accepted schedule results.",
      source: { file: sourceFile, sheet: "Winning_Streaks" },
    }] : []),
    ...(currentHistoricalAnalytics.context.rejectedResultCount > 0 ? [{
      code: "HISTORICAL_ANALYTICS_RESULTS_REJECTED",
      severity: "warning" as const,
      message: `${currentHistoricalAnalytics.context.rejectedResultCount} result records were excluded because they did not match the validated analytics context.`,
    }] : []),
  ];

  const dataWithoutIssues: Omit<TrackerData, "validationIssues"> = {
    sourceFile,
    meta: {
      leagueYear,
      leagueYearLabel,
      currentSplit,
      currentWeek,
      latestAppWritebackWeek: appBaseline.latestAppWritebackWeek,
      latestAppWritebackCompletedAt: appBaseline.latestAppWritebackCompletedAt,
      appBaselineCompletedThroughWeek: selectedContext.completedThroughYearWeek,
      usesAppWritebackSheets: appBaseline.hasWritebackSheets,
      currentStatus,
      userLeague: league(dashboard.get("User-Liga")),
      userWrestler: dashboard.get("User-Wrestler") || "",
      nextUserShow: dashboard.get("Nächste User-Show") || "",
    },
    splits: [
      { name: "Opening Split", yearWeekStart: 1, yearWeekEnd: 24, regularWeeks: 22, tiebreakerWeek: 23, finalsWeek: 24 },
      { name: "Closing Split", yearWeekStart: 25, yearWeekEnd: 48, regularWeeks: 22, tiebreakerWeek: 23, finalsWeek: 24 },
    ],
    weeks,
    leagues: activeLeagues,
    matches: authoritativeMatches,
    results: workbookBackedResults,
    appWritebackResults: acceptedAppResults,
    standings,
    headToHead: currentHistoricalAnalytics.headToHead,
    streaks: currentHistoricalAnalytics.streaks,
    historicalAnalytics,
    completedSplitHistory,
    matchupReference,
    hasLeagueFinalsTemplate: Boolean(workbook.Sheets.PPV_Template_Layout),
    workflowContext,
  };

  return {
    ...dataWithoutIssues,
    validationIssues: [
      ...validateTrackerData(dataWithoutIssues),
      ...validateCurrentLeagueComposition(standings, authoritativeMatches, selectedContext.split),
      ...historicalAnalyticsIssues,
      ...workbookWarnings(workbook, sourceFile),
      ...appBaseline.validationIssues.map((issue) => ({
        ...issue,
        source: issue.source ? { ...issue.source, file: sourceFile } : undefined,
      })),
    ],
  };
}
