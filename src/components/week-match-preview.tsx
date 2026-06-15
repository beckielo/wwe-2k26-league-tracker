"use client";

import { useState, type CSSProperties } from "react";
import type { Match } from "@/domain/types";
import { getLeagueBrandAsset } from "@/domain/brand-assets";
import { LeagueBrandMark, LeagueDecorativeArt } from "./brand-assets";

interface WeekMatchPreviewProps {
  matches: Match[];
  sourceLabel: string;
}

export function WeekMatchPreview({ matches, sourceLabel }: WeekMatchPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const orderedMatches = [...matches].sort((a, b) =>
    a.league.localeCompare(b.league) || a.matchNumber - b.matchNumber,
  );

  if (!orderedMatches.length) return null;

  const safeActiveIndex = activeIndex % orderedMatches.length;
  const activeMatch = orderedMatches[safeActiveIndex];
  const asset = getLeagueBrandAsset(activeMatch.league);
  const splitWeek = activeMatch.split === "Closing Split" ? activeMatch.week - 24 : activeMatch.week;
  const showDay = activeMatch.showDay || "Show day unavailable";
  const sourceContext = activeMatch.source.sheet
    ? `${activeMatch.source.sheet}${activeMatch.source.row ? ` · Row ${activeMatch.source.row}` : ""}`
    : sourceLabel;

  function move(offset: number) {
    setActiveIndex((current) => (current + offset + orderedMatches.length) % orderedMatches.length);
  }

  return <section
    className={`week-match-preview league-${asset.id}`}
    aria-label="Week Match Preview"
    style={{ "--brand-primary": asset.primaryColor, "--brand-accent": asset.accentColor } as CSSProperties}
  >
    <LeagueDecorativeArt league={activeMatch.league} className="match-preview-backdrop" />
    <div className="match-preview-vignette" />
    <header className="match-preview-header">
      <div>
        <p>Authoritative schedule · Week Match Preview</p>
        <h2>{activeMatch.split} · Split Week {splitWeek}</h2>
      </div>
      <span>{safeActiveIndex + 1} / {orderedMatches.length}</span>
    </header>

    <div className="match-preview-stage">
      <div className="match-preview-league">
        <LeagueBrandMark league={activeMatch.league} usage="compact-badge" />
        <span><small>{showDay}</small><strong>{activeMatch.league}</strong></span>
      </div>
      <p className="match-preview-bout">Bout {String(activeMatch.matchNumber).padStart(2, "0")}</p>
      <div className="match-preview-versus">
        <strong>{activeMatch.wrestlerA}</strong>
        <span>VS</span>
        <strong>{activeMatch.wrestlerB}</strong>
      </div>
      <dl className="match-preview-source">
        <div><dt>League Year</dt><dd>{activeMatch.leagueYear}</dd></div>
        <div><dt>Round</dt><dd>{activeMatch.roundType}</dd></div>
        <div><dt>Schedule source</dt><dd>{sourceContext}</dd></div>
      </dl>
    </div>

    {orderedMatches.length > 1 && <>
      <button type="button" className="match-preview-previous" onClick={() => move(-1)} aria-label="Previous Match">
        <span aria-hidden>←</span><b>Previous</b>
      </button>
      <button type="button" className="match-preview-next" onClick={() => move(1)} aria-label="Next Match">
        <b>Next Match</b><span aria-hidden>→</span>
      </button>
    </>}
  </section>;
}
