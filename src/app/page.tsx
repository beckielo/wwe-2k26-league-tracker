import Link from "next/link";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { WorkflowSummaryBanner } from "@/components/workflow-summary-banner";
import { loadTrackerData } from "@/data/workbook";
import { deriveSplitCompletionReview } from "@/domain/split-completion";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
const data = loadTrackerData();
const splitReview = deriveSplitCompletionReview({
leagueYear: data.meta.leagueYear,
split: data.meta.currentSplit,
completedThroughWeek: data.meta.appBaselineCompletedThroughWeek,
standings: data.standings,
matches: data.matches,
results: data.results,
matchupReference: data.matchupReference,
hasLeagueFinalsTemplate: data.hasLeagueFinalsTemplate,
});

const nextWeek = data.meta.appBaselineCompletedThroughWeek + 1;
const nextUserShow = splitReview.regularPhaseComplete
? "Next phase: Tiebreaker Review"
: data.meta.latestAppWritebackWeek === null
? data.meta.nextUserShow
: `${data.meta.userLeague} – Woche ${nextWeek}`;
const nextMatches = data.matchupReference
.filter(
(match) =>
match.league === data.meta.userLeague && match.week === nextWeek,
)
.sort((a, b) => a.matchNumber - b.matchNumber);

const errors = data.validationIssues.filter(
(issue) => issue.severity === "error",
);
const warnings = data.validationIssues.filter(
(issue) => issue.severity === "warning",
);

return (
<>
<PageHeader
eyebrow="Workbook baseline + local workflow"
title="League Year 2"
description="The workbook remains the authoritative baseline while browser-local confirmed results and week locks guide the active weekly workflow."
aside={ <div className="flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"> <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
Source connected </div>
}
/>

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <Stat
      label="League year"
      value={data.meta.leagueYear}
      detail="48-week calendar"
    />
    <Stat
      label="Current split"
      value="Opening"
      detail="Year Weeks 1–24"
    />
    <Stat
      label="Completed through"
      value={"Week " + data.meta.currentWeek}
      detail={data.meta.currentStatus}
    />
    {data.meta.latestAppWritebackWeek !== null && (
      <Stat
        label="App workbook baseline"
        value={"Week " + data.meta.latestAppWritebackWeek}
        detail="Using validated App_* writeback sheets"
      />
    )}
    <Stat
      label="User league"
      value="National"
      detail={data.meta.userWrestler}
    />
    <Stat
      label="Data health"
      value={errors.length ? errors.length + " errors" : "Verified"}
      detail={warnings.length + " source warnings"}
    />
  </div>

  <div className="mt-8">
    <WorkflowSummaryBanner
      matches={data.matches}
      workbookCurrentWeek={data.meta.appBaselineCompletedThroughWeek}
      userLeague={data.meta.userLeague}
    />
  </div>

  {splitReview.regularPhaseComplete && (
    <div className="mt-8 border border-amber-400/30 bg-amber-400/10 p-6">
      <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
        Opening Split status
      </p>
      <h2 className="mt-2 text-2xl font-black uppercase">
        Opening Split regular season complete
      </h2>
      <p className="mt-2 text-slate-300">Next phase: Tiebreaker Review</p>
      {splitReview.sourceWarnings.map((warning) => (
        <p key={warning} className="mt-2 text-sm text-amber-200">{warning}</p>
      ))}
      <Link
        href="/week-review"
        className="mt-5 inline-block bg-amber-400 px-4 py-3 text-xs font-black uppercase tracking-wider text-black"
      >
        Open Tiebreaker Review →
      </Link>
    </div>
  )}

  <div className="mt-8 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
    <Panel>
      <div className="flex items-start justify-between border-b border-white/10 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">
            Active next user show
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase">
            {nextUserShow}
          </h2>
        </div>

        <Link
          href="/schedule"
          className="border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
        >
          Full schedule →
        </Link>
      </div>

      <div className="divide-y divide-white/10">
        {nextMatches.length === 0 && splitReview.regularPhaseComplete && (
          <div className="p-6 text-sm leading-6 text-slate-400">
            No authoritative regular Week 23 card exists. Matchups will not be guessed or generated.
          </div>
        )}
        {nextMatches.map((match) => (
          <div
            key={match.matchNumber}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-6 py-4 transition hover:bg-white/[.025]"
          >
            <span className="text-xs font-black text-slate-600">
              {String(match.matchNumber).padStart(2, "0")}
            </span>

            <div className="flex items-center justify-center gap-3 text-center font-bold sm:text-lg">
              <span className="flex-1 text-right">{match.wrestlerA}</span>
              <span className="text-xs italic text-red-400">VS</span>
              <span className="flex-1 text-left">{match.wrestlerB}</span>
            </div>

            <span className="hidden text-[10px] uppercase tracking-wider text-slate-600 sm:block">
              Verified
            </span>
          </div>
        ))}
      </div>
    </Panel>

    <Panel>
      <div className="border-b border-white/10 p-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">
          Validation monitor
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase">
          Source warnings
        </h2>
      </div>

      <div className="space-y-3 p-5">
        {errors.length === 0 && (
          <div className="border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            All roster, schedule, points, and record checks pass.
          </div>
        )}

        {warnings.map((issue) => (
          <div
            key={issue.code + "-" + (issue.source?.sheet ?? "general")}
            className="border-l-2 border-amber-400 bg-amber-400/5 p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-amber-400">
              {issue.code.replaceAll("_", " ")}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-300">
              {issue.message}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  </div>

  <div className="mt-8 flex flex-col justify-between gap-3 border border-white/10 bg-white/[.025] px-5 py-4 text-xs text-slate-500 sm:flex-row">
    <span>Source: {data.sourceFile}</span>
    <span>
      {data.matches.length} scheduled matches · {data.results.length} completed results · {data.leagues.length} leagues
    </span>
  </div>
</>

);
}
