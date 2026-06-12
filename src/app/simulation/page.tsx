import { SimulationWorkbench } from "@/components/simulation-workbench";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadTrackerData } from "@/data/workbook";
import { buildSimulationCandidates } from "@/domain/simulation";

export const dynamic = "force-dynamic";

export default function SimulationPage() {
const data = loadTrackerData();

const simulation = buildSimulationCandidates({
matches: data.matches,
matchupReference: data.matchupReference,
leagues: data.leagues,
standings: data.standings,
streaks: data.streaks,
existingResults: data.results,
userLeague: data.meta.userLeague,
});

const eligibleLeagues = [
...new Set(simulation.candidates.map((candidate) => candidate.match.league)),
];

return (
<>
<PageHeader
eyebrow="Phase 3A · confirmed local results"
title="Simulation Studio"
description={`Generate explainable, editable previews for non-user-controlled leagues only. ${data.meta.userLeague} is detected from workbook metadata and cannot be simulated.`}
/>

```
  <div className="mb-8 grid gap-4 sm:grid-cols-3">
    <Stat
      label="Active simulation week"
      value={simulation.week ?? "Complete"}
      detail="First open scheduled week"
    />

    <Stat
      label="Eligible leagues"
      value={eligibleLeagues.length}
      detail={eligibleLeagues.join(" · ") || "No open league cards"}
    />

    <Stat
      label="Excluded user league"
      value={simulation.excludedLeague.replace(" League", "")}
      detail={data.meta.userWrestler}
    />
  </div>

  <Panel className="mb-8">
    <div className="grid gap-4 p-5 text-sm leading-6 text-slate-300 md:grid-cols-3">
      <div>
        <p className="font-black uppercase text-white">Schedule locked</p>
        <p className="text-slate-500">
          Candidates exist only when Schedule_22W and Matchup_Reference agree.
        </p>
      </div>

      <div>
        <p className="font-black uppercase text-white">Weighted, not arbitrary</p>
        <p className="text-slate-500">
          Seed/prestige, standing, points, current streak, longest streak,
          upset chance, and a 1% draw chance.
        </p>
      </div>

      <div>
        <p className="font-black uppercase text-white">No workbook writes</p>
        <p className="text-slate-500">
          Confirmation enters shared browser-local tracker state and remains
          editable until week completion.
        </p>
      </div>
    </div>
  </Panel>

  {simulation.week === null || simulation.candidates.length === 0 ? (
    <div className="border border-white/10 bg-[#111722] p-10 text-center">
      <h2 className="text-2xl font-black uppercase">
        No eligible simulation matches
      </h2>
      <p className="mt-2 text-slate-500">
        There are no open, authoritative non-user league matchups to simulate.
      </p>
    </div>
  ) : (
    <SimulationWorkbench
      week={simulation.week}
      candidates={simulation.candidates}
      scheduledMatches={data.matches}
      existingResults={data.results}
      userLeague={data.meta.userLeague}
    />
  )}
</>
```
);
}
