"use client";

import { useMemo, useState } from "react";
import { generateLegacyCommentary, sortLegacyProfiles, type LegacyProfile } from "@/domain/legacy-commentary";
import { LEAGUE_VISUALS } from "@/domain/visual-identity";
import { LeagueBrandMark } from "./brand-assets";

export function LegacyTable({ profiles }: { profiles: LegacyProfile[] }) {
  const sortedProfiles = useMemo(() => sortLegacyProfiles(profiles), [profiles]);
  const defaultFeature = sortedProfiles.find((profile) => profile.legacyTier === "S" || profile.legacyTier === "A") ?? sortedProfiles[0];
  const [selected, setSelected] = useState(defaultFeature?.wrestler ?? "");
  const selectedProfile = sortedProfiles.find((profile) => profile.wrestler === selected) ?? defaultFeature;
  const commentary = useMemo(
    () => selectedProfile ? generateLegacyCommentary(selectedProfile, sortedProfiles) : null,
    [selectedProfile, sortedProfiles],
  );

  return <div className="legacy-layout">
    <section className="legacy-rankings" aria-labelledby="legacy-rankings-title">
      <header className="legacy-section-header">
        <div><p className="broadcast-kicker">Career archive</p><h2 id="legacy-rankings-title">Legacy tier list</h2></div>
        <p className="legacy-sort-note">Sorted by Tier S-D, then wrestler name.</p>
      </header>
      <div className="legacy-table-wrap">
        <table className="legacy-table">
          <thead>
            <tr className="legacy-column-groups"><th colSpan={2}>Legacy identity</th><th colSpan={4}>Championship résumé</th><th colSpan={4}>Invincible runs & form</th></tr>
            <tr><th>Wrestler / League</th><th>Tier</th><th>League Titles</th><th>Global Titles</th><th>Elite Cups</th><th>Doubles</th><th>Inv. Splits</th><th>Inv. Hin.</th><th>Inv. Rück.</th><th>Longest Streak</th></tr>
          </thead>
          <tbody>{sortedProfiles.map((profile) => {
            const active = profile.wrestler === selectedProfile?.wrestler;
            return <tr key={profile.wrestler} className={`${active ? "is-selected" : ""} league-${LEAGUE_VISUALS[profile.currentLeague].key}`}>
              <td><button className="legacy-wrestler-button" onClick={() => setSelected(profile.wrestler)} aria-pressed={active}><LeagueBrandMark league={profile.currentLeague} usage="micro" /><span><strong>{profile.wrestler}</strong><small>{profile.currentLeague}</small></span></button></td>
              <td><span className={`legacy-tier tier-${(profile.legacyTier ?? "D").toLowerCase()}`}>{profile.legacyTier ?? "D"}</span></td>
              <td><span className="legacy-stat-chip">{profile.leagueWinsTotal}</span></td><td><span className="legacy-stat-chip is-global">{profile.globalChampionWins}</span></td><td><span className="legacy-stat-chip is-cup">{profile.eliteCupWins}</span></td><td><span className="legacy-stat-chip">{profile.doubles}</span></td>
              <td><span className="legacy-stat-chip">{profile.invincibleSplits}</span></td><td><span className="legacy-stat-chip">{profile.invincibleHinrunden}</span></td><td><span className="legacy-stat-chip">{profile.invincibleRueckrunden}</span></td>
              <td><strong className="legacy-streak">{profile.longestWinStreakOverall}</strong></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    {selectedProfile && commentary && <aside className={`legacy-commentary league-${LEAGUE_VISUALS[selectedProfile.currentLeague].key}`} aria-live="polite">
      <div className="legacy-commentary-top"><LeagueBrandMark league={selectedProfile.currentLeague} usage="crest" /><div><p>{commentary.voice}</p><h2>{selectedProfile.wrestler}</h2><span className="commentary-category">Tier {selectedProfile.legacyTier ?? "D"} · {commentary.category}</span></div></div>
      <p className="commentary-rankline">Tier {selectedProfile.legacyTier ?? "D"} · {selectedProfile.currentLeague} · {selectedProfile.legacyScore ?? 0} legacy points</p>
      <blockquote>{commentary.feature ? commentary.text : `No feature column for this tier. ${commentary.text}`}</blockquote>
      {commentary.statCallouts.length > 0 && <div className="commentary-callouts" aria-label="Selected legacy statistics">
        {commentary.statCallouts.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
      </div>}
      <h3>Recorded evidence</h3>
      <div className="evidence-tags" aria-label="Commentary evidence">
        {commentary.evidenceTags.length
          ? commentary.evidenceTags.map((tag) => <span key={tag}>{tag}</span>)
          : <span>Current League Only</span>}
      </div>
      <p className="commentary-boundary">Generated from recorded legacy values. Missing achievements are not inferred.</p>
    </aside>}
  </div>;
}
