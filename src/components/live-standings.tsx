"use client";

import { useMemo } from "react";
import { LeagueIcon } from "./league-icon";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { reconstructActiveSplitLiveStandings, validateActiveSplitStandings } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type StandingRow, type TrackerMeta } from "@/domain/types";
import { LEAGUE_VISUALS, placementLabel, placementZone } from "@/domain/visual-identity";

interface LiveStandingsProps {
  baseline: StandingRow[];
  workbookMatches: Match[];
  workbookResults: MatchResult[];
  meta: TrackerMeta;
  sourceFile: string;
}

const legend = [
  ["rank-1", "#1 Champion"],
  ["rank-2", "#2 High value"],
  ["rank-3", "#3 Contender"],
  ["rank-4", "#4 Final slot"],
  ["mid-table", "#5–8 Mid-table"],
  ["rank-9", "#9 Danger"],
  ["rank-10", "#10 Danger"],
  ["rank-11", "#11 Critical"],
  ["rank-12", "#12 Direct relegation"],
  ["regional-hold", "Regional #5–12 Hold / Safe"],
] as const;

// Phase 10.8.6 supersedes calculateLiveStandingsFromCurrentMaster for rendering:
// reconstructActiveSplitLiveStandings keeps roster reconstruction and locked-result application together.

function LeagueTable({ league, rows, userLeague }: { league: LeagueName; rows: StandingRow[]; userLeague: LeagueName }) {
  const visual = LEAGUE_VISUALS[league];
  const isUserLeague = league === userLeague;
  return <section className={`live-league-panel full-live-standings league-${visual.key}${isUserLeague ? " is-user-league" : ""}`} aria-label={`${league} live standings`}>
    <header className="live-league-header">
      <LeagueDecorativeArt league={league} className="live-league-decoration" />
      <LeagueBrandMark league={league} usage="watermark" className="live-league-watermark" />
      <LeagueBrandMark league={league} usage="crest" />
      <div>
        <p>{isUserLeague ? "Your division · live" : "Live division table"}</p>
        <h2>{league}</h2>
      </div>
      {isUserLeague && <span className="user-league-badge">User league</span>}
    </header>
    <div className="live-table-wrap">
      <table className="live-table">
        <thead><tr><th>Rank</th><th>Wrestler</th><th title="Matches played">M</th><th title="Wins">W</th><th title="Draws">D</th><th title="Losses">L</th><th>Points</th><th>Position status</th></tr></thead>
        <tbody>{rows.map((row) => {
          const zone = placementZone(row.rank, league);
          return <tr key={row.wrestler} className={`full-live-standings-row placement-${zone}`}>
            <td><span className="rank-badge">{row.rank}</span></td>
            <td><strong>{row.wrestler}</strong><small>Seed {row.seed}</small></td>
            <td>{row.matches}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td>
            <td className="points-cell">{row.points}</td>
            <td><span className="zone-pill">{placementLabel(league, row.rank)}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}

export function LiveStandings({ baseline, workbookMatches, workbookResults, meta, sourceFile }: LiveStandingsProps) {
  const { state, hydrated } = useTrackerState();
  const matches = useMemo(() => getActiveWorkflowMatches(state, workbookMatches), [state, workbookMatches]);
  const userLeague = state.activeWorkflow?.userLeague ?? meta.userLeague;
  const split = state.activeWorkflow?.split ?? meta.currentSplit;
  const splitWeek = state.activeWorkflow?.splitWeek ?? (meta.currentSplit === "Closing Split" ? Math.max(1, meta.currentWeek - 24) : meta.currentWeek);
  const live = useMemo(
    () => reconstructActiveSplitLiveStandings({
      previousFinalStandings: baseline,
      scheduledMatches: matches,
      masterResults: workbookResults,
      localResults: hydrated ? state.confirmedResults : [],
      split,
      completedThroughWeek: meta.appBaselineCompletedThroughWeek ?? meta.currentWeek,
    }),
    [baseline, hydrated, matches, meta.appBaselineCompletedThroughWeek, meta.currentWeek, state.confirmedResults, split, workbookResults],
  );
  const standings = live.standings;
  const source = state.activeWorkflow?.scheduleSource ?? `Workbook · ${sourceFile}`;
  const diagnostics = [...live.diagnostics, ...validateActiveSplitStandings(standings, splitWeek)];
  const lastUpdate = state.completedWeeks.at(-1)?.completedAt ?? meta.latestAppWritebackCompletedAt ?? state.activeWorkflow?.activatedAt ?? null;

  return <>
    <section className="live-standings-hero">
      <div className="live-hero-mark"><LeagueIcon name="table" /></div>
      <div>
        <p className="eyebrow">Four divisions · one live table</p>
        <h1>{split} Standings</h1>
        <p>Current master standings are authoritative for the active split; browser-local overlays are applied only beyond the workbook/app baseline. No fixture or result is inferred.</p>
      </div>
      <div className="live-broadcast-status"><span />Live table feed<strong>{split} · Week {splitWeek}</strong></div>
    </section>

    <dl className="live-source-deck">
      <div><dt>Competition</dt><dd>League Year {state.activeWorkflow?.leagueYear ?? meta.leagueYear}</dd></div>
      <div><dt>Current window</dt><dd>{split} · Split Week {splitWeek}</dd></div>
      <div><dt>Table source</dt><dd>{source}</dd></div>
      <div><dt>Last lock / update</dt><dd>{lastUpdate ? new Date(lastUpdate).toLocaleString() : `Workbook through Week ${meta.currentWeek}`}</dd></div>
    </dl>

    {diagnostics.length > 0 && <section className="source-warning" role="alert">
      <strong>Active split standings source warning</strong>
      <ul>{diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul>
    </section>}

    <section className="rank-zone-legend" aria-label="Position color legend">
      <div><LeagueIcon name="belt" /><span><strong>Position zones</strong><small>Tinted rows and rank plates show competitive status.</small></span></div>
      <ul>{legend.map(([zone, label]) => <li key={zone}><i className={`legend-${zone}`} />{label}</li>)}</ul>
    </section>

    <div className="live-league-grid">
      {LEAGUE_NAMES.map((league) => <LeagueTable
        key={league}
        league={league}
        userLeague={userLeague}
        rows={standings.filter((row) => row.league === league).sort((a, b) => a.rank - b.rank)}
      />)}
    </div>
  </>;
}
