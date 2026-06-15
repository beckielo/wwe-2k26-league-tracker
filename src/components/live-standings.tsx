"use client";

import { useMemo } from "react";
import { LeagueCrest, LeagueIcon } from "./league-icon";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { calculateStandingsWithConfirmedResults } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type StandingRow, type TrackerMeta } from "@/domain/types";
import { LEAGUE_VISUALS, placementLabel, placementZone } from "@/domain/visual-identity";

interface LiveStandingsProps {
  baseline: StandingRow[];
  workbookMatches: Match[];
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
  ["rank-12", "#12 Relegation"],
] as const;

function LeagueTable({ league, rows, userLeague }: { league: LeagueName; rows: StandingRow[]; userLeague: LeagueName }) {
  const visual = LEAGUE_VISUALS[league];
  const isUserLeague = league === userLeague;
  return <section className={`live-league-panel league-${visual.key}${isUserLeague ? " is-user-league" : ""}`} aria-label={`${league} live standings`}>
    <header className="live-league-header">
      <LeagueCrest league={league} size="large" />
      <div>
        <p>{isUserLeague ? "Your division · live" : "Live division table"}</p>
        <h2>{league}</h2>
      </div>
      {isUserLeague && <span className="user-league-badge">User league</span>}
    </header>
    <div className="live-table-wrap">
      <table className="live-table">
        <thead><tr><th>Rank</th><th>Wrestler</th><th title="Matches played">P</th><th title="Wins">W</th><th title="Draws">D</th><th title="Losses">L</th><th>Points</th><th>Position status</th></tr></thead>
        <tbody>{rows.map((row) => {
          const zone = placementZone(row.rank);
          return <tr key={row.wrestler} className={`placement-${zone}`}>
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

export function LiveStandings({ baseline, workbookMatches, meta, sourceFile }: LiveStandingsProps) {
  const { state, hydrated } = useTrackerState();
  const matches = useMemo(() => getActiveWorkflowMatches(state, workbookMatches), [state, workbookMatches]);
  const standings = useMemo(
    () => calculateStandingsWithConfirmedResults(baseline, matches, hydrated ? state.confirmedResults : []),
    [baseline, hydrated, matches, state.confirmedResults],
  );
  const userLeague = state.activeWorkflow?.userLeague ?? meta.userLeague;
  const split = state.activeWorkflow?.split ?? meta.currentSplit;
  const splitWeek = state.activeWorkflow?.splitWeek ?? (meta.currentSplit === "Closing Split" ? Math.max(1, meta.currentWeek - 24) : meta.currentWeek);
  const source = state.activeWorkflow?.scheduleSource ?? `Workbook · ${sourceFile}`;
  const lastUpdate = state.completedWeeks.at(-1)?.completedAt ?? meta.latestAppWritebackCompletedAt ?? state.activeWorkflow?.activatedAt ?? null;

  return <>
    <section className="live-standings-hero">
      <div className="live-hero-mark"><LeagueIcon name="table" /></div>
      <div>
        <p className="eyebrow">Four divisions · one live table</p>
        <h1>Live Standings</h1>
        <p>Current positions from the authoritative workbook baseline, updated by confirmed browser-local results only. No fixture or result is inferred.</p>
      </div>
      <div className="live-broadcast-status"><span />Live table feed<strong>{split} · Week {splitWeek}</strong></div>
    </section>

    <dl className="live-source-deck">
      <div><dt>Competition</dt><dd>League Year {state.activeWorkflow?.leagueYear ?? meta.leagueYear}</dd></div>
      <div><dt>Current window</dt><dd>{split} · Split Week {splitWeek}</dd></div>
      <div><dt>Table source</dt><dd>{source}</dd></div>
      <div><dt>Last lock / update</dt><dd>{lastUpdate ? new Date(lastUpdate).toLocaleString() : `Workbook through Week ${meta.currentWeek}`}</dd></div>
    </dl>

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
