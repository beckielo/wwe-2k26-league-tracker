"use client";

import { useMemo, useState } from "react";
import { generateLegacyCommentary, type LegacyProfile } from "@/domain/legacy-commentary";
import { LEAGUE_VISUALS } from "@/domain/visual-identity";
import { LeagueBrandMark } from "./brand-assets";

export function LegacyTable({ profiles }: { profiles: LegacyProfile[] }) {
  const [selected, setSelected] = useState(profiles[0]?.wrestler ?? "");
  const [journalistView, setJournalistView] = useState(true);
  const selectedProfile = profiles.find((profile) => profile.wrestler === selected) ?? profiles[0];
  const commentary = useMemo(
    () => selectedProfile ? generateLegacyCommentary(selectedProfile) : null,
    [selectedProfile],
  );

  return <div className="legacy-layout">
    <section className="legacy-rankings" aria-labelledby="legacy-rankings-title">
      <header className="legacy-section-header">
        <div><p className="broadcast-kicker">Career archive</p><h2 id="legacy-rankings-title">Legacy rankings</h2></div>
        <label className="journalist-toggle"><input type="checkbox" checked={journalistView} onChange={(event) => setJournalistView(event.target.checked)} /><span>Journalist view</span></label>
      </header>
      <div className="legacy-table-wrap">
        <table className="legacy-table">
          <thead>
            <tr className="legacy-column-groups"><th colSpan={3}>Legacy identity</th><th colSpan={4}>Championship résumé</th><th colSpan={4}>Invincible runs & form</th><th>Desk analysis</th></tr>
            <tr><th>Rank</th><th>Wrestler / League</th><th>Tier</th><th>League Titles</th><th>Global Titles</th><th>Elite Cups</th><th>Doubles</th><th>Inv. Splits</th><th>Inv. Hin.</th><th>Inv. Rück.</th><th>Longest Streak</th><th>Commentary</th></tr>
          </thead>
          <tbody>{profiles.map((profile, index) => {
            const active = profile.wrestler === selectedProfile?.wrestler;
            const rowCommentary = generateLegacyCommentary(profile);
            return <tr key={profile.wrestler} className={`${active ? "is-selected" : ""} league-${LEAGUE_VISUALS[profile.currentLeague].key}`}>
              <td><span className="legacy-rank">{index + 1}</span></td>
              <td><button className="legacy-wrestler-button" onClick={() => setSelected(profile.wrestler)} aria-pressed={active}><LeagueBrandMark league={profile.currentLeague} usage="micro" /><span><strong>{profile.wrestler}</strong><small>{profile.currentLeague}</small></span></button></td>
              <td>{profile.goatStatusTier ? <span className={`legacy-tier tier-${profile.goatStatusTier.toLowerCase()}`}>{profile.goatStatusTier}</span> : <span className="legacy-empty">—</span>}</td>
              <td><span className="legacy-stat-chip">{profile.leagueWinsTotal}</span></td><td><span className="legacy-stat-chip is-global">{profile.globalChampionWins}</span></td><td><span className="legacy-stat-chip is-cup">{profile.eliteCupWins}</span></td><td><span className="legacy-stat-chip">{profile.doubles}</span></td>
              <td><span className="legacy-stat-chip">{profile.invincibleSplits}</span></td><td><span className="legacy-stat-chip">{profile.invincibleHinrunden}</span></td><td><span className="legacy-stat-chip">{profile.invincibleRueckrunden}</span></td>
              <td><strong className="legacy-streak">{profile.longestWinStreakOverall}</strong></td>
              <td><button className="legacy-analysis-button" onClick={() => setSelected(profile.wrestler)}>
                <span>{journalistView ? rowCommentary.category : "Workbook source note"}</span>
                <small>{journalistView ? rowCommentary.excerpt : (profile.sourceCommentary ?? "No source note recorded.")}</small>
                <b>Read full analysis <span aria-hidden>→</span></b>
              </button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    {selectedProfile && commentary && <aside className={`legacy-commentary league-${LEAGUE_VISUALS[selectedProfile.currentLeague].key}`} aria-live="polite">
      <div className="legacy-commentary-top"><LeagueBrandMark league={selectedProfile.currentLeague} usage="crest" /><div><p>{commentary.voice}</p><h2>{selectedProfile.wrestler}</h2><span className="commentary-category">{commentary.category}</span></div></div>
      <p className="commentary-rankline">Rank #{profiles.indexOf(selectedProfile) + 1} · {selectedProfile.currentLeague} · Tier {selectedProfile.goatStatusTier ?? "not recorded"}</p>
      {journalistView
        ? <blockquote>{commentary.text}</blockquote>
        : <blockquote>{selectedProfile.sourceCommentary ?? "No source commentary is recorded for this wrestler."}</blockquote>}
      {commentary.statCallouts.length > 0 && <div className="commentary-callouts" aria-label="Selected legacy statistics">
        {commentary.statCallouts.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
      </div>}
      <h3>Recorded evidence</h3>
      <div className="evidence-tags" aria-label="Commentary evidence">
        {commentary.evidenceTags.length
          ? commentary.evidenceTags.map((tag) => <span key={tag}>{tag}</span>)
          : <span>Current League Only</span>}
      </div>
      <p className="commentary-boundary">Generated from this row’s workbook-backed fields. Missing achievements are not inferred.</p>
    </aside>}
  </div>;
}
