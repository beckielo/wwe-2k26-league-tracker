"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { generateSocialFeed, predictMatch } from "@/domain/match-predictions";
import { buildHistoricalResults } from "@/domain/match-history";
import { getPreviousHeadToHeadContext } from "@/domain/head-to-head";
import { getRecentForm } from "@/domain/recent-form";
import { getWorkflowSummary } from "@/domain/week-progression";
import { getWeekDisplay } from "@/domain/week-display";
import type { LeagueName, Match, MatchResult, StandingRow, TrackerMeta, ValidationIssue } from "@/domain/types";
import { LEAGUE_NAMES } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { CurrentUserSwitcher, useCurrentUser } from "./current-user-switcher";
import { ReplaceWrestlerControl } from "./replace-wrestler-control";
import { EmptyState, StatusBadge } from "./ui";
import { LeagueBrandMark, LeagueDecorativeArt, LeagueWatermark } from "./brand-assets";
import { LEAGUE_VISUALS, placementLabel, placementZone } from "@/domain/visual-identity";
import { getPreviousSplitChampionColorRoles, getPreviousSplitNameColorRole, keepCurrentRunConsistentChampionColorRoles, type PreviousSplitNameColorRole } from "@/domain/previous-split-name-colors";
import { ControllerIcon, isCurrentUserWrestler, WrestlerNameWithRole } from "./wrestler-name-with-role";
import type { LegacyCompletedSplitAudit } from "@/domain/legacy";

interface DashboardControlCenterProps {
  workbookMatches: Match[];
  workbookCompletedThroughWeek: number;
  baselineStandings: StandingRow[];
  workbookResults: MatchResult[];
  meta: TrackerMeta;
  leagueYear: number;
  userLeague: LeagueName;
  validationIssues: ValidationIssue[];
  legacySummary: {
    leader: string | null;
    leagueWinners: number;
    eliteCupWinners: number;
    completedSplitAudit?: LegacyCompletedSplitAudit;
  };
}

export function DashboardControlCenter(props: DashboardControlCenterProps) {
  const { state, authority, hydrated } = useTrackerState();
  const matches = getActiveWorkflowMatches(state, props.workbookMatches);
  const workflowBaseline = authority.completedThroughYearWeek;
  const live = reconstructActiveSplitLiveStandings({
    previousFinalStandings: props.baselineStandings,
    scheduledMatches: matches,
    masterResults: props.workbookResults,
    localResults: state.confirmedResults,
    split: authority.split,
    completedThroughWeek: authority.completedThroughYearWeek,
    baselineCompletedThroughYearWeek: props.workbookCompletedThroughWeek,
    activeLeagueYear: authority.leagueYear,
    postFinalsAssignments: state.activeWorkflow ? LEAGUE_NAMES.flatMap((league) => state.acceptedPostFinalsComposition?.rosters[league] ?? []) : undefined,
    rosterReplacements: state.rosterReplacements ?? [],
  });
  const selectedUser = useCurrentUser(live.composition).currentUser;
  const selectedUserLeague = selectedUser?.league ?? props.userLeague;
  const summary = getWorkflowSummary(state, matches, workflowBaseline, selectedUserLeague);
  const yearWeek = summary.activeWeek ?? authority.activeYearWeek;
  const leagueYear = authority.leagueYear;
  const split = authority.split;
  const userLeague = selectedUserLeague;
  const display = getWeekDisplay(leagueYear, yearWeek, split);
  const userLeagueRows = live.standings.filter((row) => row.league === userLeague).sort((a, b) => a.rank - b.rank);
  const currentRanks = new Map(userLeagueRows.map((row) => [row.wrestler, row.rank]));
  const previousSplitChampionColorRoles = keepCurrentRunConsistentChampionColorRoles(
    getPreviousSplitChampionColorRoles(props.legacySummary.completedSplitAudit, state.completedSplitLegacyCommits),
    live.composition,
  );
  const allKnownMatches = [...props.workbookMatches.filter((match) => !matches.some((active) => active.id === match.id)), ...matches];
  const matchHistory = buildHistoricalResults(
    allKnownMatches,
    props.workbookResults,
    state.confirmedResults,
  );
  const card = matches
    .filter((match) => match.week === yearWeek && match.league === userLeague)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const socialFeed = generateSocialFeed(live.standings, matches.filter((match) => match.week >= yearWeek), state.confirmedResults, userLeague);
  const cardIds = new Set(card.map((match) => match.id));
  const completed = state.confirmedResults.filter((result) => cardIds.has(result.matchId)).length;
  const blocking = props.validationIssues.filter((issue) => issue.severity === "error");
  const nextHref = card.length ? "/results" : "/schedule-setup";
  const nextLabel = card.length ? "Enter card results" : "Open schedule setup";
  const workflowBlocked = blocking.length > 0 || card.length === 0;
  const workflowStatus = workflowBlocked ? "Blocked" : completed > 0 ? "In Progress" : "Ready";

  if (!hydrated) return <div className="dashboard-loading">Loading active league control…</div>;

  return <>
    <CurrentUserSwitcher standings={live.composition} />
    <section className={`command-deck league-${LEAGUE_VISUALS[userLeague].key}`} aria-labelledby="command-title">
      <LeagueDecorativeArt league={userLeague} className="command-decorative-art" />
      <LeagueWatermark league={userLeague} />
      <div className="command-context">
        <p className="broadcast-kicker">Live league control</p>
        <div className="command-title-row">
          <div className="command-brand-title">
            <LeagueBrandMark league={userLeague} usage="crest" />
            <div>
            <p className="command-season">League Year {leagueYear}</p>
            <h2 id="command-title">{display.primary}</h2>
            </div>
          </div>
          <StatusBadge tone={workflowBlocked ? "locked" : completed > 0 ? "current" : "ready"}>
            {workflowStatus}
          </StatusBadge>
        </div>
        <p className="command-subline">{selectedUser?.wrestler ?? props.meta.userWrestler} · {userLeague} · {card[0]?.showDay ?? "Show pending"} · {completed} / {card.length || 6} results recorded</p>
      </div>
      <div className="next-action-block">
        <span>Next action</span>
        <strong>{card.length ? `Complete the ${userLeague} card` : "Open the next scheduled card"}</strong>
        <p>{card.length ? "Record all six outcomes, then review and lock the week." : "No matchup is shown until an accepted schedule supplies it."}</p>
        <div className="dashboard-workflow-actions dashboard-workflow-actions-spaced">
          <Link href={nextHref} className="action-button action-primary">{nextLabel}</Link>
          <Link href="/simulation" className="rounded-lg border border-white/15 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300">Simulation</Link>
          <Link href="/week-review" className="rounded-lg border border-emerald-400/30 px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-300">Week Review</Link>
        </div>
      </div>
    </section>


    <div className="dashboard-primary-grid dashboard-equal-panels">
      <section className="fight-card-panel dashboard-equal-panel">
        <header className="fight-card-header">
          <div className="fight-card-title"><LeagueBrandMark league={userLeague} usage="compact" /><span>
            <p className="broadcast-kicker">Current user-controlled show</p>
            <h2>{userLeague}</h2>
            <p>{display.compact} · Official schedule</p>
          </span></div>
          <Link href="/schedule">Full schedule</Link>
        </header>
        {card.length ? <ol className="fight-card-list fight-card-list-compact">
          {card.map((match) => {
            const leftForm = getRecentForm(match.wrestlerA, matchHistory).lastOutcomes.map((outcome) => outcome.emoji).join(" ");
            const rightForm = getRecentForm(match.wrestlerB, matchHistory).lastOutcomes.map((outcome) => outcome.emoji).join(" ");
            const h2h = getPreviousHeadToHeadContext({ wrestlerA: match.wrestlerA, wrestlerB: match.wrestlerB, leagueYear: match.leagueYear, split: match.split, week: match.week, matchNumber: match.matchNumber, currentMatchId: match.id, results: matchHistory });
            return <li key={match.id} className="fight-card-bout-compact">
              <span className="bout-number">MATCH {String(match.matchNumber).padStart(2, "0")}</span>
              <div className="matchup matchup-context">
                <span className="form-strip" aria-label={`${match.wrestlerA} recent form`}>{leftForm}</span>
                <strong className={wrestlerNameClassName(h2h.shouldUnderlineLeft)}><DashboardShowWrestlerName wrestler={match.wrestlerA} currentUserWrestler={selectedUser?.wrestler ?? props.meta.userWrestler} championRoles={previousSplitChampionColorRoles}>{formatRankedWrestler(match.wrestlerA, currentRanks.get(match.wrestlerA))}</DashboardShowWrestlerName></strong>
                <span className="matchup-vs">VS</span>
                <strong className={wrestlerNameClassName(h2h.shouldUnderlineRight)}><DashboardShowWrestlerName wrestler={match.wrestlerB} currentUserWrestler={selectedUser?.wrestler ?? props.meta.userWrestler} championRoles={previousSplitChampionColorRoles}>{formatRankedWrestler(match.wrestlerB, currentRanks.get(match.wrestlerB))}</DashboardShowWrestlerName></strong>
                <span className="form-strip" aria-label={`${match.wrestlerB} recent form`}>{rightForm}</span>
              </div>
              <PredictionStrip prediction={predictMatch(match, live.standings, state.confirmedResults)} />
            </li>;
          })}
        </ol> : <div className="p-6">
          <EmptyState title="No current card available" description="The control center will display matches after the next schedule has been accepted." />
          <div className="mt-4"><Link href="/schedule-setup" className="action-button action-secondary">Review schedule setup</Link></div>
        </div>}
      </section>

      <UserLeagueLiveTable league={userLeague} rows={userLeagueRows} currentUserWrestler={selectedUser?.wrestler ?? props.meta.userWrestler} championRoles={previousSplitChampionColorRoles} />
    </div>
    <SocialFeed comments={socialFeed} />
    {SHOW_REPLACE_WRESTLER_ON_DASHBOARD && (
      <ReplaceWrestlerControl activeRoster={live.composition} matches={matches} leagueYear={leagueYear} split={split} week={yearWeek} />
    )}
  </>;
}

const SHOW_REPLACE_WRESTLER_ON_DASHBOARD = false;

const dashboardShowNameColorClassByRole: Record<PreviousSplitNameColorRole, string> = {
  "double-winner": "name-color-double-winner",
  "elite-cup": "name-color-elite-cup",
  "global-champion": "name-color-global-champion",
  "continental-champion": "name-color-continental-champion",
  "national-champion": "name-color-national-champion",
  "regional-champion": "name-color-regional-champion",
  normal: "name-color-normal",
};

function DashboardShowWrestlerName({ wrestler, currentUserWrestler, championRoles, children }: { wrestler: string; currentUserWrestler?: string | null; championRoles: ReturnType<typeof getPreviousSplitChampionColorRoles>; children: ReactNode }) {
  const role = getPreviousSplitNameColorRole({ wrestler, championRoles });
  const isCurrentUser = isCurrentUserWrestler(wrestler, currentUserWrestler);
  return <span className={["dashboard-show-name-content", dashboardShowNameColorClassByRole[role]].join(" ")}>
    <span className="dashboard-show-name-text">{children}</span>
    {isCurrentUser && <ControllerIcon className="dashboard-show-current-user-icon" />}
  </span>;
}

function wrestlerNameClassName(isLastHeadToHeadWinner: boolean) {
  return ["dashboard-show-wrestler-name", isLastHeadToHeadWinner ? "h2h-last-winner h2hWinnerName" : null].filter(Boolean).join(" ");
}


function formatRankedWrestler(wrestler: string, rank?: number) {
  return rank ? `#${rank} ${wrestler}` : wrestler;
}

function PredictionStrip({ prediction }: { prediction: ReturnType<typeof predictMatch> }) {
  return <div className="prediction-strip" aria-label={`${prediction.wrestlerA} ${prediction.probabilityA}% win chance, ${prediction.wrestlerB} ${prediction.probabilityB}% win chance, ${prediction.confidence} confidence`}>
    <div className="prediction-bars">
      <span style={{ width: `${prediction.probabilityA}%` }}>{prediction.probabilityA}%</span>
      <span style={{ width: `${prediction.probabilityB}%` }}>{prediction.probabilityB}%</span>
    </div>
  </div>;
}

function UserLeagueLiveTable({ league, rows, currentUserWrestler, championRoles }: { league: LeagueName; rows: StandingRow[]; currentUserWrestler?: string | null; championRoles: ReturnType<typeof getPreviousSplitChampionColorRoles> }) {
  return <section className={`dashboard-live-table dashboard-equal-panel league-${LEAGUE_VISUALS[league].key}`} aria-labelledby="dashboard-live-table-title">
    <header>
      <div className="dashboard-live-table-title"><LeagueBrandMark league={league} usage="compact" /><span><p className="broadcast-kicker">Current user table</p><h2 id="dashboard-live-table-title">{league}</h2></span></div>
      <Link href="/live-standings" className="dashboard-live-table-heading-pill">Full Live Standings</Link>
    </header>
    <div className="dashboard-live-table-wrap dashboard-live-table-wrap-compact"><table className="dashboard-live-table-compact">
      <thead><tr><th>#</th><th>Wrestler</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>Status</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.wrestler} className={`placement-${placementZone(row.rank, league)}`}>
        <td>{row.rank}</td><td><strong><WrestlerNameWithRole wrestler={row.wrestler} currentUserWrestler={currentUserWrestler} championRoles={championRoles} /></strong></td><td>{row.matches}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td><strong>{row.points}</strong></td><td><span className="zone-pill">{placementLabel(league, row.rank)}</span></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function SocialFeed({ comments }: { comments: ReturnType<typeof generateSocialFeed> }) {
  return <section className="social-feed" aria-labelledby="social-feed-title">
    <header><div><p className="broadcast-kicker">Fan & media reactions</p><h2 id="social-feed-title">League Social Feed</h2></div><span>{comments.length} live comments</span></header>
    <div className="social-feed-grid">{comments.map((comment) => <article key={`${comment.handle}-${comment.eventTag}-${comment.evidence}`}>
      <div><strong>{comment.handle}</strong><span>{comment.leagueTag} · {comment.eventTag}</span></div>
      <p>{comment.text}</p>
      <small>Evidence: {comment.evidence}</small>
    </article>)}</div>
  </section>;
}
