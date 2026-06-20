"use client";

import Link from "next/link";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { reconstructActiveSplitLiveStandings } from "@/domain/tracker-state";
import { generateSocialFeed, predictMatch } from "@/domain/match-predictions";
import { buildHistoricalResults } from "@/domain/match-history";
import { getLastHeadToHead } from "@/domain/head-to-head";
import { getRecentForm } from "@/domain/recent-form";
import { getWorkflowSummary } from "@/domain/week-progression";
import { getWeekDisplay } from "@/domain/week-display";
import type { LeagueName, Match, MatchResult, StandingRow, TrackerMeta, ValidationIssue } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { CurrentUserSwitcher, useCurrentUser } from "./current-user-switcher";
import { ReplaceWrestlerControl } from "./replace-wrestler-control";
import { EmptyState, StatusBadge } from "./ui";
import { InteractivePanel, LeagueBrandMark, LeagueDecorativeArt, LeagueWatermark } from "./brand-assets";
import { LEAGUE_VISUALS, placementLabel, placementZone } from "@/domain/visual-identity";

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
  };
}

export function DashboardControlCenter(props: DashboardControlCenterProps) {
  const { state, hydrated } = useTrackerState();
  const matches = getActiveWorkflowMatches(state, props.workbookMatches);
  const workflowBaseline = state.activeWorkflow ? 24 : props.workbookCompletedThroughWeek;
  const live = reconstructActiveSplitLiveStandings({
    previousFinalStandings: props.baselineStandings,
    scheduledMatches: matches,
    masterResults: props.workbookResults,
    localResults: state.confirmedResults,
    split: state.activeWorkflow?.split ?? props.meta.currentSplit,
    completedThroughWeek: props.workbookCompletedThroughWeek,
    rosterReplacements: state.rosterReplacements ?? [],
  });
  const selectedUser = useCurrentUser(live.composition).currentUser;
  const selectedUserLeague = selectedUser?.league ?? props.userLeague;
  const summary = getWorkflowSummary(state, matches, workflowBaseline, selectedUserLeague);
  const yearWeek = summary.activeWeek ?? state.activeWorkflow?.yearWeek ?? props.workbookCompletedThroughWeek + 1;
  const leagueYear = state.activeWorkflow?.leagueYear ?? props.leagueYear;
  const split = state.activeWorkflow?.split;
  const userLeague = selectedUserLeague;
  const display = getWeekDisplay(leagueYear, yearWeek, split);
  const userLeagueRows = live.standings.filter((row) => row.league === userLeague).sort((a, b) => a.rank - b.rank);
  const currentRanks = new Map(userLeagueRows.map((row) => [row.wrestler, row.rank]));
  const allKnownMatches = [...props.workbookMatches.filter((match) => !matches.some((active) => active.id === match.id)), ...matches];
  const matchHistory = buildHistoricalResults(allKnownMatches, props.workbookResults, state.confirmedResults);
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
    <ReplaceWrestlerControl activeRoster={live.composition} matches={matches} leagueYear={leagueYear} split={split ?? props.meta.currentSplit} week={yearWeek} />
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
        <strong>{card.length ? `Complete the ${userLeague} card` : "Connect the next authoritative card"}</strong>
        <p>{card.length ? "Record all six outcomes, then review and lock the week." : "No matchup is shown until an accepted schedule supplies it."}</p>
        <Link href={nextHref} className="action-button action-primary">{nextLabel}<span aria-hidden>→</span></Link>
      </div>
    </section>


    <InteractivePanel href="/legacy" className="legacy-quick-link league-global">
      <span className="legacy-quick-rank" aria-hidden>Ⅰ</span>
      <span className="legacy-quick-copy"><small>GOAT / Legacy Rankings</small><strong>Open Legacy Table</strong><em>Career Archive · honours, streaks and invincible runs</em></span>
      <span className="legacy-quick-teaser">
        <small>Current legacy leader</small>
        <strong>{props.legacySummary.leader ?? "Archive pending"}</strong>
        <em>{props.legacySummary.leagueWinners} league title records · {props.legacySummary.eliteCupWinners} Elite Cup records</em>
      </span>
      <b aria-hidden>→</b>
    </InteractivePanel>

    <div className="dashboard-primary-grid dashboard-equal-panels">
      <section className="fight-card-panel dashboard-equal-panel">
        <header className="fight-card-header">
          <div className="fight-card-title"><LeagueBrandMark league={userLeague} usage="compact" /><span>
            <p className="broadcast-kicker">Current user-controlled show</p>
            <h2>{userLeague}</h2>
            <p>{display.compact} · Authoritative schedule</p>
          </span></div>
          <Link href="/schedule">Full schedule <span aria-hidden>→</span></Link>
        </header>
        {card.length ? <ol className="fight-card-list fight-card-list-compact">
          {card.map((match) => {
            const leftForm = getRecentForm(match.wrestlerA, matchHistory).lastOutcomes.map((outcome) => outcome.emoji).join(" ");
            const rightForm = getRecentForm(match.wrestlerB, matchHistory).lastOutcomes.map((outcome) => outcome.emoji).join(" ");
            const h2h = getLastHeadToHead(match.wrestlerA, match.wrestlerB, matchHistory, match.id);
            return <li key={match.id} className="fight-card-bout-compact">
              <span className="bout-number">MATCH {String(match.matchNumber).padStart(2, "0")}</span>
              <div className="matchup matchup-context">
                <span className="form-strip" aria-label={`${match.wrestlerA} recent form`}>{leftForm}</span>
                <strong className={h2h.shouldUnderlineLeft ? "h2h-last-winner" : undefined}>{formatRankedWrestler(match.wrestlerA, currentRanks.get(match.wrestlerA))}</strong>
                <span className="matchup-vs">VS</span>
                <strong className={h2h.shouldUnderlineRight ? "h2h-last-winner" : undefined}>{formatRankedWrestler(match.wrestlerB, currentRanks.get(match.wrestlerB))}</strong>
                <span className="form-strip" aria-label={`${match.wrestlerB} recent form`}>{rightForm}</span>
              </div>
              <PredictionStrip prediction={predictMatch(match, live.standings, state.confirmedResults)} />
            </li>;
          })}
        </ol> : <div className="p-6">
          <EmptyState title="No current card available" description="The control center will display matches only after they are present in the workbook schedule or an explicitly accepted schedule snapshot." />
          <div className="mt-4"><Link href="/schedule-setup" className="action-button action-secondary">Review schedule setup</Link></div>
        </div>}
      </section>

      <UserLeagueLiveTable league={userLeague} rows={userLeagueRows} />
    </div>
    <SocialFeed comments={socialFeed} />
    <p className="dashboard-diagnostics-note">Source Warnings remain available in review workflows · Non-blocking · details contained.</p>
  </>;
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

function UserLeagueLiveTable({ league, rows }: { league: LeagueName; rows: StandingRow[] }) {
  return <section className={`dashboard-live-table dashboard-equal-panel league-${LEAGUE_VISUALS[league].key}`} aria-labelledby="dashboard-live-table-title">
    <header>
      <div className="dashboard-live-table-title"><LeagueBrandMark league={league} usage="compact" /><span><p className="broadcast-kicker">Current user table</p><h2 id="dashboard-live-table-title">{league}</h2></span></div>
      <Link href="/live-standings" className="dashboard-live-table-heading-pill">Full Live Standings</Link>
    </header>
    <div className="dashboard-live-table-wrap dashboard-live-table-wrap-compact"><table className="dashboard-live-table-compact">
      <thead><tr><th>#</th><th>Wrestler</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>Status</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.wrestler} className={`placement-${placementZone(row.rank, league)}`}>
        <td>{row.rank}</td><td><strong>{row.wrestler}</strong></td><td>{row.matches}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td><strong>{row.points}</strong></td><td><span className="zone-pill">{placementLabel(league, row.rank)}</span></td>
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
