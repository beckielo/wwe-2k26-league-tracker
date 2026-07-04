"use client";

import { useState } from "react";
import { Panel } from "./ui";
import { LEAGUE_NAMES, type Match } from "@/domain/types";
import { getActiveWorkflowMatches } from "@/domain/schedule-setup";
import { useTrackerState } from "@/state/tracker-state-provider";
import { getWeekDisplay } from "@/domain/week-display";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";
import { WeekMatchPreview } from "./week-match-preview";

const SHOW_LABELS = {
  "Regional League": "Monday",
  "National League": "Tuesday",
  "Continental League": "Wednesday",
  "Global League": "Friday",
} as const;

export function ActiveSchedule({ workbookMatches }: { workbookMatches: Match[]; workbookCurrentWeek: number }) {
  const { state, authority, hydrated } = useTrackerState();
  const [filter, setFilter] = useState<"all" | "open" | "completed">("all");

  if (!hydrated) return <p className="text-slate-500">Loading active schedule…</p>;

  const active = authority.activeSource !== "workbook-dashboard";
  const matches = getActiveWorkflowMatches(state, workbookMatches);
  const week = authority.activeYearWeek;
  const display = getWeekDisplay(authority.leagueYear, week, authority.split);
  const weekMatches = matches.filter((match) => (
    match.leagueYear === authority.leagueYear
    && match.split === authority.split
    && match.week === week
  ));
  const visibleMatches = weekMatches.filter((match) => (
    filter === "all" ||
    (filter === "open" && match.status === "scheduled") ||
    (filter === "completed" && match.status === "completed")
  ));

  return (
    <>
      <div className="schedule-context-bar">
        <div>
          <strong>{display.primary} Card</strong>
          <span>{display.secondary}</span>
          <small>{authority.scheduleSource}</small>
        </div>
        <div className="schedule-status-filters" aria-label="Match status filter">
          {([
            ["all", "All"],
            ["open", "Open"],
            ["completed", "Completed"],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              <i />
              {label}
            </button>
          ))}
        </div>
      </div>

      <WeekMatchPreview
        matches={visibleMatches}
        sourceLabel={authority.scheduleSource}
      />

      <div className="schedule-league-grid">
        {LEAGUE_NAMES.slice().reverse().map((league) => {
          const rows = visibleMatches
            .filter((match) => match.league === league)
            .sort((a, b) => a.matchNumber - b.matchNumber);

          return (
            <Panel key={league}>
              <div className="schedule-league-header">
                <LeagueDecorativeArt league={league} />
                <LeagueBrandMark league={league} usage="compact-badge" />
                <div>
                  <p>{SHOW_LABELS[league]}</p>
                  <h2>{league}</h2>
                </div>
                <span>{rows.length} matches</span>
              </div>

              {rows.length > 0 ? (
                <ol className="sports-match-list">
                  {rows.map((match) => (
                    <li key={match.id} className={`sports-match-card match-${match.status}`}>
                      <span className="sports-match-number">{String(match.matchNumber).padStart(2, "0")}</span>
                      <strong className="sports-match-participant participant-a">{match.wrestlerA}</strong>
                      <span className="sports-match-versus">VS</span>
                      <strong className="sports-match-participant participant-b">{match.wrestlerB}</strong>
                      <span className="sports-match-status">{match.status === "completed" ? "Completed" : "Open"}</span>
                      <small>{active ? "Accepted snapshot" : "Workbook reference"}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="schedule-empty-state">
                  No {filter === "all" ? "" : `${filter} `}matches for this league in the active card.
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
