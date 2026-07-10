"use client";

import { useMemo } from "react";
import { LeagueIcon } from "./league-icon";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";
import { useTrackerState } from "@/state/tracker-state-provider";
import { useCurrentUser } from "./current-user-switcher";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { reconstructActiveSplitLiveStandings, validateActiveSplitStandings } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type StandingRow, type TrackerMeta } from "@/domain/types";
import { LEAGUE_VISUALS, placementLabel, placementZone } from "@/domain/visual-identity";
import { keepCurrentRunConsistentChampionColorRoles, type PreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import { getCurrentRunPreviousSplitChampionColorRoles } from "@/data/current-run-legacy-snapshot";
import type { LegacyCompletedSplitAudit } from "@/domain/legacy";
import { WrestlerNameWithRole } from "./wrestler-name-with-role";

interface LiveStandingsProps {
  baseline: StandingRow[];
  workbookMatches: Match[];
  workbookResults: MatchResult[];
  meta: TrackerMeta;
  completedSplitAudit?: LegacyCompletedSplitAudit;
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

function LeagueTable({ league, rows, userLeague, currentUserWrestler, championRoles }: { league: LeagueName; rows: StandingRow[]; userLeague: LeagueName; currentUserWrestler?: string | null; championRoles: Map<string, PreviousSplitNameColorRole> }) {
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
            <td><span className="live-wrestler-meta"><strong><WrestlerNameWithRole wrestler={row.wrestler} currentUserWrestler={currentUserWrestler} championRoles={championRoles} /></strong><small>Seed {row.seed}</small></span></td>
            <td>{row.matches}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td>
            <td className="points-cell">{row.points}</td>
            <td><span className="zone-pill">{placementLabel(league, row.rank)}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="live-mobile-standings">
      {rows.map((row) => {
        const zone = placementZone(row.rank, league);
        return (
          <article key={row.wrestler} className={`live-mobile-standing placement-${zone}`}>
            <span className="rank-badge">{row.rank}</span>
            <div className="live-mobile-standing-name">
              <strong>
                <WrestlerNameWithRole
                  wrestler={row.wrestler}
                  currentUserWrestler={currentUserWrestler}
                  championRoles={championRoles}
                />
              </strong>
              <small>Seed {row.seed}</small>
            </div>
            <div className="live-mobile-standing-record">
              <span>{row.matches} played</span>
              <strong>{row.wins}-{row.draws}-{row.losses}</strong>
            </div>
            <div className="live-mobile-standing-points">
              <strong>{row.points}</strong>
              <small>Pts</small>
            </div>
            <span className="zone-pill">{placementLabel(league, row.rank)}</span>
          </article>
        );
      })}
    </div>
  </section>;
}

export function LiveStandings({ baseline, workbookMatches, workbookResults, meta, completedSplitAudit }: LiveStandingsProps) {
  const { state, authority, hydrated } = useTrackerState();
  const matches = useMemo(() => getActiveWorkflowMatches(state, workbookMatches), [state, workbookMatches]);
  const split = authority.split;
  const splitWeek = authority.splitWeek;
  const activeCompletedThroughWeek = authority.completedThroughYearWeek;
  const live = useMemo(
    () => reconstructActiveSplitLiveStandings({
      previousFinalStandings: baseline,
      postFinalsAssignments: state.activeWorkflow ? LEAGUE_NAMES.flatMap((league) => state.acceptedPostFinalsComposition?.rosters[league] ?? []) : undefined,
      scheduledMatches: matches,
      masterResults: workbookResults,
      localResults: hydrated ? state.confirmedResults : [],
      split,
      completedThroughWeek: activeCompletedThroughWeek,
      baselineCompletedThroughYearWeek: meta.appBaselineCompletedThroughWeek,
      activeLeagueYear: authority.leagueYear,
    }),
    [activeCompletedThroughWeek, authority.leagueYear, baseline, hydrated, matches, meta.appBaselineCompletedThroughWeek, state.acceptedPostFinalsComposition?.rosters, state.activeWorkflow, state.confirmedResults, split, workbookResults],
  );
  const standings = live.standings;
  const previousSplitChampionColorRoles = useMemo(
    () => keepCurrentRunConsistentChampionColorRoles(
      getCurrentRunPreviousSplitChampionColorRoles(completedSplitAudit, state.completedSplitLegacyCommits),
      live.composition,
    ),
    [completedSplitAudit, live.composition, state.completedSplitLegacyCommits],
  );
  const selectedUser = useCurrentUser(live.composition).currentUser;
  const userLeague = state.activeWorkflow?.userLeague ?? selectedUser?.league ?? meta.userLeague;
  const diagnostics = [...live.diagnostics, ...validateActiveSplitStandings(standings, splitWeek)];
  const lastUpdate = state.completedWeeks.at(-1)?.completedAt ?? meta.latestAppWritebackCompletedAt ?? state.activeWorkflow?.activatedAt ?? null;

  return <>
    <section className="live-standings-hero">
      <div className="live-hero-mark"><LeagueIcon name="table" /></div>
      <div>
        <p className="eyebrow">Four divisions · one live table</p>
        <h1>{split} Standings</h1>
        <p>Completed results define the active split table. Current-week updates are applied only after you save them, and no fixture or result is inferred.</p>
      </div>
      <div className="live-broadcast-status"><span />Live table feed<strong>{split} · Week {splitWeek}</strong></div>
    </section>

    <dl className="live-source-deck">
      <div><dt>Competition</dt><dd>League Year {authority.leagueYear}</dd></div>
      <div><dt>Current window</dt><dd>{split} · Split Week {splitWeek}</dd></div>
      <div><dt>Progress status</dt><dd>Saved through Year Week {authority.completedThroughYearWeek}</dd></div>
      <div><dt>Last lock / update</dt><dd>{lastUpdate ? `${new Date(lastUpdate).toISOString().slice(0, 16).replace("T", " ")} UTC` : `Through Year Week ${authority.completedThroughYearWeek}`}</dd></div>
    </dl>

    {diagnostics.length > 0 && <details className="source-warning">
      <summary>
        <span>
          <strong>Data details</strong>
          <small>{diagnostics.length} notice{diagnostics.length === 1 ? "" : "s"}</small>
        </span>
        <b>Review details</b>
      </summary>
      <div role="alert">
        <ul>{diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul>
      </div>
    </details>}

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
        currentUserWrestler={selectedUser?.wrestler ?? meta.userWrestler}
        championRoles={previousSplitChampionColorRoles}
      />)}
    </div>
  </>;
}
