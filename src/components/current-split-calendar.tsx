"use client";

import { useMemo, useState } from "react";
import { resolveCurrentUser } from "@/domain/current-user";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import type { LeagueName, Match, MatchResult, StandingRow } from "@/domain/types";
import { LEAGUE_NAMES } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";
import {
  buildCurrentSplitCalendar,
  type CalendarWeekState,
  type CurrentSplitCalendarMatch,
  type CurrentSplitCalendarWeek,
} from "./current-split-calendar-model";

interface CurrentSplitCalendarProps {
  matches: Match[];
  workbookResults: MatchResult[];
  workbookCompletedThroughWeek: number;
  standings: StandingRow[];
  userLeague: LeagueName;
}

const weekStateLabels: Record<CalendarWeekState, string> = {
  completed: "Completed",
  confirmed: "Confirmed",
  partial: "Partial",
};

export function CurrentSplitCalendar(props: CurrentSplitCalendarProps) {
  const { state, authority, hydrated } = useTrackerState();
  const [selectedYearWeek, setSelectedYearWeek] = useState<number | null>(null);
  const [selectedWrestler, setSelectedWrestler] = useState("");
  const selectedUser = resolveCurrentUser(props.standings, state.currentUserWrestler);
  const userLeague = state.activeWorkflow?.userLeague ?? selectedUser?.league ?? props.userLeague;
  const workflowMatches = useMemo(
    () => getActiveWorkflowMatches(state, props.matches),
    [props.matches, state],
  );
  const calendar = useMemo(() => buildCurrentSplitCalendar({
    matches: workflowMatches,
    workbookResults: props.workbookResults,
    localResults: state.confirmedResults,
    completedWeeks: state.completedWeeks,
    workbookCompletedThroughWeek: props.workbookCompletedThroughWeek,
    leagueYear: authority.leagueYear,
    split: authority.split,
    userLeague,
  }), [
    authority.leagueYear,
    authority.split,
    props.workbookCompletedThroughWeek,
    props.workbookResults,
    state.completedWeeks,
    state.confirmedResults,
    userLeague,
    workflowMatches,
  ]);
  const activeWeek = calendar.weeks.find((week) => week.yearWeek === selectedYearWeek)
    ?? calendar.weeks.at(-1)
    ?? null;
  const wrestlerTimeline = useMemo(
    () => selectedWrestler
      ? calendar.weeks.flatMap((week) => week.matches.filter((match) => (
          match.wrestlerA === selectedWrestler || match.wrestlerB === selectedWrestler
        )))
      : [],
    [calendar.weeks, selectedWrestler],
  );

  if (!hydrated) {
    return <div className="authority-loading" role="status">Loading current split calendar...</div>;
  }

  return <div className="current-split-calendar">
    <section className="calendar-context" aria-labelledby="calendar-context-title">
      <div>
        <p className="broadcast-kicker">Current split results</p>
        <h2 id="calendar-context-title">{authority.split} Calendar</h2>
        <p>League Year {authority.leagueYear} / confirmed results from this split only</p>
      </div>
      <div className="calendar-context-stats" aria-label="Calendar summary">
        <span><strong>{calendar.weeks.length}</strong> result weeks</span>
        <span><strong>{calendar.confirmedResultCount}</strong> confirmed results</span>
        <span><strong>{userLeague.replace(" League", "")}</strong> user league</span>
      </div>
    </section>

    {calendar.weeks.length === 0 ? (
      <section className="calendar-empty-state" aria-label="No calendar results">
        <p className="broadcast-kicker">No confirmed results yet</p>
        <h2>The current split calendar is empty</h2>
        <p>Results appear here only after manual entry or simulation has been confirmed. Schedule previews and future fixtures are not shown as results.</p>
      </section>
    ) : (
      <>
        <section className="calendar-controls" aria-label="Calendar controls">
          <div>
            <label htmlFor="calendar-wrestler">Wrestler view</label>
            <select
              id="calendar-wrestler"
              value={selectedWrestler}
              onChange={(event) => setSelectedWrestler(event.target.value)}
            >
              <option value="">All wrestlers - selected week</option>
              {calendar.wrestlerNames.map((wrestler) => (
                <option key={wrestler} value={wrestler}>{wrestler} - full split timeline</option>
              ))}
            </select>
          </div>
          <p>Only confirmed current-split results are available. Choose a wrestler for their complete split timeline.</p>
        </section>

        <section className="calendar-week-navigation" aria-label="Current split matchdays">
          {calendar.weeks.map((week) => {
            const selected = !selectedWrestler && activeWeek?.yearWeek === week.yearWeek;
            return <button
              type="button"
              key={week.yearWeek}
              data-split-week={week.splitWeek}
              aria-pressed={selected}
              onClick={() => {
                setSelectedYearWeek(week.yearWeek);
                setSelectedWrestler("");
              }}
            >
              <span>{week.roundType}</span>
              <strong>Week {week.splitWeek}</strong>
              <small>{weekStateLabels[week.state]} / {week.confirmedCount}/{week.scheduledCount}</small>
            </button>;
          })}
        </section>

        {selectedWrestler ? (
          <WrestlerTimeline
            wrestler={selectedWrestler}
            matches={wrestlerTimeline}
            userLeague={userLeague}
          />
        ) : activeWeek ? (
          <CalendarWeekResults week={activeWeek} userLeague={userLeague} />
        ) : null}
      </>
    )}
  </div>;
}

function CalendarWeekResults({ week, userLeague }: { week: CurrentSplitCalendarWeek; userLeague: LeagueName }) {
  const userMatches = week.matches.filter((match) => match.league === userLeague);
  const simulatedLeagues = LEAGUE_NAMES.filter((league) => league !== userLeague);
  return <div className="calendar-results">
    <header className="calendar-results-header">
      <div>
        <p className="broadcast-kicker">{week.roundType}</p>
        <h2>Split Week {week.splitWeek}</h2>
      </div>
      <span className={`calendar-week-state state-${week.state}`}>
        {weekStateLabels[week.state]} / {week.confirmedCount}/{week.scheduledCount} results
      </span>
    </header>

    <LeagueResultPanel
      league={userLeague}
      matches={userMatches}
      mode="user"
    />

    <section className="calendar-simulated-section" aria-labelledby="simulated-leagues-title">
      <header>
        <p className="broadcast-kicker">Confirmed simulation results</p>
        <h2 id="simulated-leagues-title">Simulated Leagues</h2>
      </header>
      <div className="calendar-league-grid">
        {simulatedLeagues.map((league) => (
          <LeagueResultPanel
            key={league}
            league={league}
            matches={week.matches.filter((match) => match.league === league)}
            mode="simulation"
          />
        ))}
      </div>
    </section>
  </div>;
}

function LeagueResultPanel({
  league,
  matches,
  mode,
}: {
  league: LeagueName;
  matches: CurrentSplitCalendarMatch[];
  mode: "user" | "simulation";
}) {
  return <section className={`calendar-league-panel mode-${mode}`} aria-label={`${league} calendar results`}>
    <header>
      <LeagueDecorativeArt league={league} />
      <LeagueBrandMark league={league} usage="compact-badge" />
      <div>
        <p>{mode === "user" ? "User-controlled league" : "Simulated league"}</p>
        <h3>{league}</h3>
      </div>
      <span>{matches.length} confirmed</span>
    </header>
    {matches.length ? (
      <ol className="calendar-match-list">
        {matches.map((match) => <CalendarMatchCard key={match.matchId} match={match} />)}
      </ol>
    ) : (
      <p className="calendar-league-empty">No confirmed results for this league in the selected week.</p>
    )}
  </section>;
}

function CalendarMatchCard({ match, showWeek = false }: { match: CurrentSplitCalendarMatch; showWeek?: boolean }) {
  return <li className="calendar-match-card">
    <span className="calendar-match-number">{showWeek ? `W${match.splitWeek}` : String(match.matchNumber).padStart(2, "0")}</span>
    <div className="calendar-match-participants">
      <strong className={match.winner === match.wrestlerA ? "is-winner" : ""}>{match.wrestlerA}</strong>
      <span>vs</span>
      <strong className={match.winner === match.wrestlerB ? "is-winner" : ""}>{match.wrestlerB}</strong>
    </div>
    <div className="calendar-match-result">
      <strong>{match.resultLabel}</strong>
      <span>{match.sourceLabel} / {match.isWeekCompleted ? "Week completed" : "Confirmed"}</span>
    </div>
  </li>;
}

function WrestlerTimeline({
  wrestler,
  matches,
  userLeague,
}: {
  wrestler: string;
  matches: CurrentSplitCalendarMatch[];
  userLeague: LeagueName;
}) {
  return <section className="calendar-wrestler-timeline" aria-label={`${wrestler} current split timeline`}>
    <header>
      <div>
        <p className="broadcast-kicker">Wrestler perspective</p>
        <h2>{wrestler}</h2>
        <p>Every confirmed match for this wrestler in the current split.</p>
      </div>
      <span>{matches.length} confirmed matches</span>
    </header>
    {matches.length ? (
      <ol className="calendar-match-list">
        {matches.map((match) => <li key={match.matchId} className="calendar-timeline-entry">
          <div className="calendar-timeline-heading">
            <span>Split Week {match.splitWeek}</span>
            <strong>{match.league}</strong>
            <small>{match.league === userLeague ? "User League" : "Simulated League"}</small>
          </div>
          <CalendarMatchCard match={match} showWeek />
        </li>)}
      </ol>
    ) : (
      <p className="calendar-league-empty">No confirmed current-split matches are available for this wrestler.</p>
    )}
  </section>;
}
