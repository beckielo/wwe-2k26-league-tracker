"use client";

import Link from "next/link";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { getWeekDisplay } from "@/domain/week-display";
import type { LeagueName, Match, ValidationIssue } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { EmptyState, StatusBadge } from "./ui";
import { InteractivePanel, LeagueBrandMark, LeagueWatermark } from "./brand-assets";
import { LEAGUE_VISUALS } from "@/domain/visual-identity";

interface DashboardControlCenterProps {
  workbookMatches: Match[];
  workbookCompletedThroughWeek: number;
  leagueYear: number;
  userLeague: LeagueName;
  validationIssues: ValidationIssue[];
}

export function DashboardControlCenter(props: DashboardControlCenterProps) {
  const { state, hydrated } = useTrackerState();
  if (!hydrated) return <div className="dashboard-loading">Loading active league control…</div>;

  const matches = getActiveWorkflowMatches(state, props.workbookMatches);
  const yearWeek = state.activeWorkflow?.yearWeek ?? props.workbookCompletedThroughWeek + 1;
  const leagueYear = state.activeWorkflow?.leagueYear ?? props.leagueYear;
  const split = state.activeWorkflow?.split;
  const userLeague = state.activeWorkflow?.userLeague ?? props.userLeague;
  const display = getWeekDisplay(leagueYear, yearWeek, split);
  const card = matches
    .filter((match) => match.week === yearWeek && match.league === userLeague)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const cardIds = new Set(card.map((match) => match.id));
  const completed = state.confirmedResults.filter((result) => cardIds.has(result.matchId)).length;
  const openReviews = (state.manualReviews ?? []).filter((review) => review.status === "open");
  const blocking = props.validationIssues.filter((issue) => issue.severity === "error");
  const sourceWarnings = props.validationIssues.filter((issue) => issue.severity === "warning");
  const historical = sourceWarnings.filter((issue) => /histor|legacy|baseline|source/i.test(`${issue.code} ${issue.message}`));
  const currentWarnings = sourceWarnings.filter((issue) => !historical.includes(issue));
  const nextHref = card.length ? "/results" : "/schedule-setup";
  const nextLabel = card.length ? "Enter card results" : "Open schedule setup";
  const workflowBlocked = blocking.length > 0 || card.length === 0;
  const workflowStatus = workflowBlocked ? "Blocked" : completed > 0 ? "In Progress" : "Ready";

  return <>
    <section className={`command-deck league-${LEAGUE_VISUALS[userLeague].key}`} aria-labelledby="command-title">
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
        <p className="command-subline">{userLeague} · {card[0]?.showDay ?? "Show pending"} · {completed} / {card.length || 6} results recorded</p>
      </div>
      <div className="next-action-block">
        <span>Next action</span>
        <strong>{card.length ? `Complete the ${userLeague} card` : "Connect the next authoritative card"}</strong>
        <p>{card.length ? "Record all six outcomes, then review and lock the week." : "No matchup is shown until an accepted schedule supplies it."}</p>
        <Link href={nextHref} className="action-button action-primary">{nextLabel}<span aria-hidden>→</span></Link>
      </div>
    </section>

    <InteractivePanel href="/live-standings" className={`live-table-quick-link league-${LEAGUE_VISUALS[userLeague].key}`}>
      <LeagueBrandMark league={userLeague} usage="compact" />
      <span><small>All four divisions · current positions</small><strong>Open Live Table</strong></span>
      <b aria-hidden>→</b>
    </InteractivePanel>

    <div className="dashboard-primary-grid">
      <section className="fight-card-panel">
        <header className="fight-card-header">
          <div>
            <p className="broadcast-kicker">Current user-controlled show</p>
            <h2>{userLeague}</h2>
            <p>{display.compact} · Authoritative schedule</p>
          </div>
          <Link href="/schedule">Full schedule <span aria-hidden>→</span></Link>
        </header>
        {card.length ? <ol className="fight-card-list">
          {card.map((match) => {
            const recorded = state.confirmedResults.some((result) => result.matchId === match.id);
            return <li key={match.id}>
              <span className="bout-number">Bout {String(match.matchNumber).padStart(2, "0")}</span>
              <div className="matchup"><strong>{match.wrestlerA}</strong><span>VS</span><strong>{match.wrestlerB}</strong></div>
              <StatusBadge tone={recorded ? "completed" : "ready"}>{recorded ? "Recorded" : "Ready"}</StatusBadge>
            </li>;
          })}
        </ol> : <div className="p-6">
          <EmptyState title="No current card available" description="The control center will display matches only after they are present in the workbook schedule or an explicitly accepted schedule snapshot." />
          <div className="mt-4"><Link href="/schedule-setup" className="action-button action-secondary">Review schedule setup</Link></div>
        </div>}
      </section>

      <AlertCenter blocking={blocking} reviews={openReviews.map((review) => review.note)} sourceWarnings={currentWarnings} historical={historical} />
    </div>
  </>;
}

function AlertCenter({ blocking, reviews, sourceWarnings, historical }: {
  blocking: ValidationIssue[];
  reviews: string[];
  sourceWarnings: ValidationIssue[];
  historical: ValidationIssue[];
}) {
  const countLabel = (count: number, singular: string) => `${count} ${count === 1 ? singular : `${singular}s`}`;
  return <aside className="alert-center" aria-labelledby="alert-title">
    <header>
      <div><p className="broadcast-kicker">Control room monitor</p><h2 id="alert-title">Alerts & review</h2></div>
      <StatusBadge tone={blocking.length ? "locked" : reviews.length ? "review" : "completed"}>{blocking.length ? "Blocked" : reviews.length ? "Review" : "Clear"}</StatusBadge>
    </header>
    <div className="alert-summary">
      <AlertCount count={blocking.length} label="blocking issue" tone="blocking" />
      <AlertCount count={reviews.length} label="review item" tone="review" />
      <AlertCount count={sourceWarnings.length + historical.length} label="source warning" tone="source" />
    </div>
    {blocking.length > 0 && <AlertDetails title="Blocking" count={blocking.length} open items={blocking.map((issue) => `${issue.code.replaceAll("_", " ")} — ${issue.message}`)} />}
    {reviews.length > 0 && <AlertDetails title="Review Required" count={reviews.length} items={reviews} />}
    {sourceWarnings.length > 0 && <AlertDetails title="Source Warnings" count={sourceWarnings.length} items={sourceWarnings.map((issue) => issue.message)} />}
    {historical.length > 0 && <AlertDetails title="Historical / Legacy Warnings" count={historical.length} items={historical.map((issue) => issue.message)} />}
    {!blocking.length && !reviews.length && !sourceWarnings.length && !historical.length && <p className="alert-clear">All current workflow and source checks pass.</p>}
    <p className="alert-footnote">{countLabel(sourceWarnings.length + historical.length, "source warning")} · Non-blocking · details contained.</p>
  </aside>;
}

function AlertCount({ count, label, tone }: { count: number; label: string; tone: string }) {
  return <div className={`alert-count alert-count-${tone}`}><strong>{count}</strong><span>{count === 1 ? label : `${label}s`}</span></div>;
}

function AlertDetails({ title, count, items, open = false }: { title: string; count: number; items: string[]; open?: boolean }) {
  return <details className="alert-details" open={open}>
    <summary><span>{title}</span><span>{count}</span></summary>
    <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
  </details>;
}
