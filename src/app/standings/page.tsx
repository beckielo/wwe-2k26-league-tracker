import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { LEAGUE_NAMES } from "@/domain/types";

function zoneClass(rank: number) {
  if (rank === 1) return "border-l-emerald-400";
  if (rank <= 4) return "border-l-sky-400";
  if (rank >= 9 && rank <= 11) return "border-l-amber-400";
  if (rank === 12) return "border-l-red-500";
  return "border-l-transparent";
}

function compactZoneStatus(status: string) {
  return [...new Set(status.split("·").map((part) => part.trim()).filter(Boolean))].join(" · ");
}

export const dynamic = "force-dynamic";

export default function StandingsPage() {
  const data = loadTrackerData();

  return (
    <>
      <PageHeader
        eyebrow={`Through Week ${data.meta.currentWeek}`}
        title="All Standings"
        description="Records and points are imported from Standings_Current and reconciled against the completed schedule results. Zone labels are source values and remain provisional until clinching is explicitly encoded."
        aside={<Link href="/live-standings" className="action-button action-primary">Open Live Table</Link>}
      />

      <div className="standings-detail-grid">
        {LEAGUE_NAMES.map((league) => {
          const rows = data.standings
            .filter((row) => row.league === league)
            .sort((a, b) => a.rank - b.rank);

          return (
            <Panel key={league} className="detailed-standings-panel">
              <div className="detailed-standings-heading">
                <div>
                  <p>12-wrestler division</p>
                  <h2>{league}</h2>
                </div>
                <span>P W D L · 3/1/0 points</span>
              </div>

              <div className="detailed-table-wrap">
                <table className="detailed-standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Wrestler</th>
                      <th>Seed</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>Pts</th>
                      <th>Current zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.wrestler} className={`border-l-2 ${zoneClass(row.rank)}`}>
                        <td>{row.rank}</td>
                        <td><strong>{row.wrestler}</strong></td>
                        <td>{row.seed}</td>
                        <td>{row.matches}</td>
                        <td>{row.wins}</td>
                        <td>{row.draws}</td>
                        <td>{row.losses}</td>
                        <td><strong>{row.points}</strong></td>
                        <td title={row.status}>{compactZoneStatus(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="detailed-mobile-standings">
                {rows.map((row) => (
                  <article key={row.wrestler} className={`detailed-mobile-standing ${zoneClass(row.rank)}`}>
                    <b>{row.rank}</b>
                    <span>
                      <strong>{row.wrestler}</strong>
                      <small>Seed {row.seed}</small>
                    </span>
                    <span>
                      <strong>{row.wins}-{row.draws}-{row.losses}</strong>
                      <small>{row.matches} played</small>
                    </span>
                    <span>
                      <strong>{row.points}</strong>
                      <small>Pts</small>
                    </span>
                    <em title={row.status}>{compactZoneStatus(row.status)}</em>
                  </article>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
