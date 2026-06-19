# WWE 2K26 League Tracker — Implementation Plan

## Scope of this plan

This plan is based on inspection of the repository and every file in `source-docs`. It does **not** begin application implementation. The first deliverable should be a typed, tested ingestion and validation layer that preserves source authority and reports uncertainty rather than inventing missing rules.

## 1. Data sources found

### Repository sources

| Source | Role | Authority |
| --- | --- | --- |
| `AGENTS.md` | Project-level engineering and source-of-truth constraints | Binding project instruction |
| `README.md` | Repository title only; no functional specification yet | Informational |

### `source-docs` sources

| Source | Contents found | Authority and intended use |
| --- | --- | --- |
| `[source-docs-current-master] WWE_2K26_Liga_System_LY2_Opening_W13_abgeschlossen.xlsx` | 14 worksheets containing current dashboard state, roster/seeds, 48-week calendar, 22-week-per-split schedule, standings, results/H2H, winning streaks, workflow, changelog, next show, legacy data, PPV layout, matchup reference, and schedule audit | Highest authority for current standings, results, schedules, roster state, active split/week, and next matchups |
| `[source-docs-WWE_2K26_Regelwerk_Master] WWE_2K26_Regelwerk_Master_v1_0.pdf` | Historical/general rule source covering hierarchy, scoring, promotion/relegation, League Finals, Elite Cup, special cases, workflow, and known open questions; its old 13-week season structure is superseded for League Year 2 | Authoritative where not superseded by the current workbook and active Year-2 rules |
| `[source-docs-AI-ruleset-start-instructions] WWE_2K26_Regelwerk_KI_Startanweisung.txt` | Concise source-precedence and update workflow instructions | Authoritative workflow reinforcement |
| `.gitkeep` | Empty placeholder | No domain data |

### Workbook sheet inventory

| Sheet | Primary information |
| --- | --- |
| `Dashboard` | League Year 2 Opening Split; Week 13 complete; next user show is National Week 14 |
| `Roster_Seeds` | 48 current wrestlers, four leagues, seeds 1–12 |
| `Year_Calendar_48W` | Opening Split Weeks 1–24 and Closing Split Weeks 25–48 |
| `Schedule_22W` | 528 regular fixtures, results through Week 13, open Weeks 14–22 |
| `Standings_Current` | Current rank, seed, record, points, and zone for all 48 wrestlers |
| `H2H_Tracker` | 312 completed match results through Week 13 |
| `Winning_Streaks` | Current and longest streak data for all wrestlers |
| `Calendar_Workflow` | Current calendar summary and workbook-stated tiebreak hierarchy |
| `Changelog` | Operational updates, corrections, and current-state history |
| `Next_Show` | Six National League Week 14 user-show matchups |
| `Legacy_Tracker` | Historical awards and GOAT-oriented metrics/commentary |
| `PPV_Template_Layout` | Two-night League Finals card template and proposed Elite Cup bracket |
| `Matchup_Reference` | Verified matchup reference for all 22 regular weeks; explicitly authoritative for future matchup prompts |
| `Schedule_Audit` | Workbook-supplied schedule integrity results and Week 13/14 correction record |

### Current state snapshot

- Competition: League Year 2, Opening Split.
- Progress: Week 13 is complete; Weeks 14–22 remain in the regular league phase.
- Current data volume: 48 wrestlers, 528 scheduled regular matches, 312 completed results, 216 open matches.
- User-controlled league/wrestler: National League / Beckielo.
- Next user show: National League Week 14.
- Next user-show matchups, in workbook order:
  1. Shinsuke Nakamura vs LA Knight
  2. Jey Uso vs Sami Zayn
  3. Penta vs Ethan Page
  4. Trick Williams vs Beckielo
  5. Carmelo Hayes vs Rey Mysterio
  6. Austin Theory vs Dominik Mysterio

These matchups are descriptive evidence for the plan, not hard-coded application data. The eventual application must import them from the workbook matchup reference.

## 2. Active rules detected

### Source authority and update behavior

- Excel controls current tables, results, schedule, roster/seeds, active week, and next show.
- The current workbook and active Year-2 rules control the League Year 2 competition format and tiebreak order. The PDF controls other fixed rules and special cases where it has not been superseded.
- A contradiction must be surfaced; no source may be silently overwritten.
- A chat message is not a final rule change until it is recorded in the authoritative files/change log.
- Matchups must be checked against the workbook schedule/reference and must never be guessed.

### Active League Year 2 structure

- A League Year has 48 weeks.
- Opening Split occupies Year Weeks 1–24.
- Closing Split occupies Year Weeks 25–48.
- Each split contains 22 regular league weeks, split Week 23 as a tiebreaker week if needed, and split Week 24 as League Finals.
- Each league contains 12 wrestlers and schedules six matches per regular week.
- Every wrestler faces every other wrestler twice per split: Weeks 1–11 are the first round and Weeks 12–22 are the return round (Rückrunde).
- The workbook schedule and `Matchup_Reference` are authoritative for the actual pairings and booking order. These structural rules validate the source schedule; they do not authorize the app to invent matchups.

### League hierarchy and show order

1. Global League — Friday
2. Continental League — Wednesday
3. National League — Tuesday
4. Regional League — Monday

Operational show order is Monday Regional, Tuesday National, Wednesday Continental, Friday Global. Each league contains 12 wrestlers; the current total roster is 48.

### Scoring and standings

- Win: 3 points.
- Draw: 1 point to each wrestler.
- Loss: 0 points.
- No bonus points.
- No penalty points unless a later explicit rule introduces them.
- The regular-table leader is the league/season champion; a later cup or relegation result does not retroactively change that champion.
- The Global Elite Cup is a separate trophy from the Global League championship.

### Schedule and result workflow

- A reported match must match an explicitly scheduled pairing.
- Validate the expected show order, participant pairing, outcome clarity, special finish, duplicate entry, and standings impact before accepting a result.
- Update only the affected league after a show.
- After a show, provide the affected standings and the next show's matchups in fixed show order.
- Unclear match reports are not scored automatically.
- A duplicate result is not entered twice.
- A wrong matchup is rejected or held pending explicit confirmation.

### Promotion, relegation, and direct movement

Between each adjacent league pair:

- Lower-league Rank 1 is directly promoted.
- Upper-league Rank 12 is directly relegated.
- Lower Ranks 2, 3, and 4 challenge Upper Ranks 11, 10, and 9 respectively.
- Regional has no lower league; Global has no higher league.

Relegation matches are 1v1, no countout, with pinfall or submission as the normal win condition. DQ remains possible and the wrestler causing the DQ loses. For no contest or an unclear stoppage, the higher-league wrestler retains the place.

### League Finals

- League Finals is a two-night PPV.
- Night One contains six matches: three Regional-to-National relegations and three National-to-Continental relegations.
- Night Two contains six matches: three Continental-to-Global relegations and the two Global Elite Cup semifinals plus final.
- Under the active League Year 2 structure, Opening Finals are in Year Week 24 and Closing Finals are in Year Week 48.

### Tiebreakers

The rulebook clearly establishes these points:

- Only ties affecting a meaningful boundary require resolution: championship, direct promotion, relegation, direct relegation, or Global Top 4 qualification.
- A standard decision match is Steel Cage No Escape, pinfall/submission only, unless explicitly changed later.
- A tie of three or more wrestlers requires a case-specific mini-tournament or multi-person format documented in Excel or the rulebook change log.

For League Year 2, standings and consequential ties use this active order: points, head-to-head, longest winning streak, then a tiebreaker match only if still tied. Seed is not an automatic tiebreak criterion. The exact head-to-head calculation for a tie of three or more wrestlers remains unspecified and must not be invented; see `docs/assumptions-and-conflicts.md`.

## 3. Conflicts or unclear points

The complete register is maintained in `docs/assumptions-and-conflicts.md`.

Resolved for the current implementation:

1. **Competition format:** League Year 2 uses 48 weeks, with Opening and Closing Splits of 24 weeks each.
2. **Double round robin:** each split has 22 regular weeks; every wrestler faces every league opponent twice, and Weeks 12–22 are the Rückrunde.
3. **Tiebreak order:** points, head-to-head, longest winning streak, then a tiebreaker match only if still tied.

Genuinely unresolved or structurally ambiguous items remain:

1. **Elite Cup bracket:** workbook fixes `#1 vs #4` and `#2 vs #3`, while the PDF marks exact seeding as unconfirmed.
2. **Ordinary match type:** no authoritative normal league-match stipulation was found.
3. **Result encoding:** the workbook column named `Result Type` stores `User`/`Simulation`, while finish types such as draw, DQ, and no contest have no demonstrated encoding.
4. **Multi-wrestler head-to-head:** the active criterion is known, but its calculation for a tie of three or more wrestlers is not specified.
5. **Excel table drift:** populated `H2H_Tracker` and `Changelog` rows extend beyond their named table ranges.
6. **Provisional language:** current standings use champion/promotion/relegation labels before the regular split is complete.
7. **Legacy calculations:** workbook-only GOAT/legacy definitions are newer than and not reconciled with rulebook v1.0.

Implementation must represent unresolved rules as explicit `unknown`/`pending-confirmation` states. It must not choose a convenient interpretation silently. The resolved League Year 2 structure and tiebreak order, however, should be implemented directly rather than emitted as conflicts.

## 4. Proposed data model

The logic model should be independent of the UI and implemented in TypeScript. Source lineage should be retained on imported entities so conflicts can point back to workbook sheet/row or rulebook section.

### Core identity and competition entities

```ts
type LeagueId = "global" | "continental" | "national" | "regional";
type SplitId = "opening" | "closing";
type CompetitionPhase =
  | "first-round-robin"
  | "return-round-robin"
  | "tiebreaker"
  | "league-finals";

interface Wrestler {
  id: string;
  displayName: string;
}

interface LeagueMembership {
  leagueYear: number;
  split: SplitId;
  leagueId: LeagueId;
  wrestlerId: string;
  seed: number;
  startStatus: string | null;
}

interface CompetitionFormat {
  leagueYear: number;
  split: SplitId;
  leagueSize: number;
  regularWeeks: number;
  matchesPerWrestler: number;
  tiebreakerWeek: number;
  finalsWeek: number;
  authorityStatus: "active-year-2-rule" | "historical" | "pending-confirmation";
}
```

`CompetitionFormat` remains explicit for versioning, but the League Year 2 instance is authoritative: 22 regular weeks, 22 matches per wrestler, tiebreaker Week 23, and finals Week 24. The old 13-week PDF structure is historical rather than a runtime conflict.

### Calendar and shows

```ts
interface LeagueWeek {
  leagueYear: number;
  yearWeek: number;
  split: SplitId;
  splitWeek: number;
  phase: CompetitionPhase;
  purpose: string;
}

interface Show {
  id: string;
  leagueYear: number;
  split: SplitId;
  week: number;
  leagueId: LeagueId;
  day: "Monday" | "Tuesday" | "Wednesday" | "Friday";
  status: "scheduled" | "in-progress" | "completed";
}
```

### Scheduled matches and results

```ts
type MatchOutcome = "decisive" | "draw" | "no-contest" | "unclear";
type FinishType = "pinfall" | "submission" | "dq" | "other" | "unknown";
type ResultSource = "user" | "simulation" | "unknown";

interface ScheduledMatch {
  id: string;
  showId: string;
  bookingOrder: number;
  wrestlerAId: string;
  wrestlerBId: string;
  matchupKey: string;
  matchType: string | null;
  scheduleSource: SourceRef;
}

interface MatchResult {
  matchId: string;
  outcome: MatchOutcome;
  winnerId: string | null;
  loserId: string | null;
  finishType: FinishType;
  dqCausedByWrestlerId: string | null;
  resultSource: ResultSource;
  notes: string | null;
  resultSourceRef: SourceRef;
}
```

Schedule and result are separate so an open match remains a valid scheduled entity, duplicate result detection is straightforward, and `User`/`Simulation` is not confused with finish type.

### Standings and tiebreak evidence

```ts
interface StandingRecord {
  leagueId: LeagueId;
  wrestlerId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface StandingSnapshot extends StandingRecord {
  leagueYear: number;
  split: SplitId;
  throughWeek: number;
  sourceRank: number;
  sourceZone: string | null;
  zoneFinality: "provisional" | "clinched" | "unknown";
}

interface TiebreakEvidence {
  wrestlerId: string;
  headToHeadPoints: number | null;
  longestWinningStreak: number | null;
  sourceSeed: number;
}
```

Calculated records should be compared with the imported standings snapshot. League Year 2 ranks should be reproduced using points, head-to-head, and longest winning streak in that order. If a consequential tie remains, mark it as requiring a tiebreaker match. For three-or-more-person ties, preserve the source rank and emit a warning if applying head-to-head would require an undocumented aggregation method.

### Finals and movement

```ts
interface QualificationSlot {
  competition: "promotion" | "relegation" | "elite-cup";
  leagueId: LeagueId;
  rank: number;
}

interface FinalsMatchTemplate {
  night: 1 | 2;
  bookingOrder: number;
  participantA: QualificationSlot | { priorMatchWinner: string };
  participantB: QualificationSlot | { priorMatchWinner: string };
  matchType: string;
  ruleAuthority: "confirmed" | "pending-confirmation";
}

interface LeagueMovement {
  wrestlerId: string;
  fromLeagueId: LeagueId;
  toLeagueId: LeagueId;
  method: "direct-promotion" | "direct-relegation" | "relegation-match";
  sourceMatchId: string | null;
}
```

### Source lineage, validation, and conflicts

```ts
interface SourceRef {
  file: string;
  sheet?: string;
  row?: number;
  section?: string;
}

type ValidationSeverity = "error" | "warning" | "info";

interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  entityType: string;
  entityId: string | null;
  sources: SourceRef[];
}

interface SourceConflict {
  code: string;
  subject: string;
  sourceA: SourceRef;
  sourceB: SourceRef;
  resolution: "excel-current-data" | "rulebook-rule" | "pending-confirmation";
  notes: string;
}
```

## 5. Proposed build phases

### Phase 0 — Source contract and fixtures

- Preserve the source files as read-only fixtures.
- Record workbook filename/version, sheet inventory, expected headers, and source checksums.
- Define which sheets are authoritative for each information type.
- Encode genuinely unresolved conflicts as documentation-backed expectations, while treating the League Year 2 format and tiebreak order as active rules.

### Phase 1 — TypeScript ingestion layer

- Add a workbook adapter that reads populated worksheet rows, not only named table ranges.
- Normalize league names, split names, days, wrestler identities, seeds, schedule rows, and results.
- Retain source references for every imported record.
- Import the instruction text and rulebook-derived configuration separately from current workbook data.
- Produce a serializable domain snapshot without any UI dependency.

### Phase 2 — Validation and reconciliation engine

- Implement pure validation functions for roster, schedule, results, standings, records, and source conflicts.
- Recalculate standings using only confirmed 3/1/0 scoring.
- Compare recalculated records with `Standings_Current` without silently replacing source ranks.
- Add tests for every calculation and special case, especially draws, DQ, no contest, direct movement, and relegation retention.
- Emit stable issue codes suitable for CI and future UI display.

### Phase 3 — Read-only application foundation

- Build a read-only state service around the validated domain snapshot.
- Expose current league tables, active week, schedule, results, roster, next show, and validation warnings.
- Keep all calculations in domain modules; UI components receive already-validated view models.
- Clearly label source standings zones as provisional unless clinching is explicitly known.

### Phase 4 — Core tracker UI

- Dashboard: current League Year/split/week and source health.
- League views: standings, roster/seeds, completed results, remaining fixtures.
- Next-show view: workbook-sourced matchups in booking order with source attribution.
- Validation view: errors, warnings, and unresolved rule conflicts.
- No fixture-generation fallback when matchup source data is missing.

### Phase 5 — Finals and movement views

- Add promotion/relegation projections from current positions, clearly marked provisional.
- Render the two-night League Finals template.
- Enable Elite Cup bracket behavior only after its seeding authority is confirmed.
- Model special results without assuming missing workbook encodings.

### Phase 6 — Controlled write/update workflow

- Only after read-only ingestion is stable, design result entry and workbook export/update behavior.
- Require scheduled-match selection rather than freehand matchup creation.
- Validate result completeness and special finishes before accepting an update.
- Prevent duplicate results and preserve an audit log.
- Recalculate only the affected league and show the next scheduled show from `Matchup_Reference`.

### Phase 7 — Legacy and historical analytics

- Import/display existing legacy facts first.
- Defer calculated GOAT tiers and weighting until workbook-only legacy rules are confirmed as authoritative.
- Add season/split snapshots so future comparisons do not mutate historical results.

## 6. Validation rules

### Source and schema validation

- Required source files must be present and uniquely identifiable by role.
- Required workbook sheets and columns must exist.
- Unknown or renamed columns must produce an explicit schema issue.
- Populated rows outside an Excel named-table range must be imported and reported as table-range drift.
- Source rows must retain file/sheet/row lineage.

### Roster validation

- Exactly four current leagues are expected unless a confirmed format says otherwise.
- Each current league must contain 12 memberships.
- Seeds must be unique within a league and cover 1–12.
- A wrestler may have only one active membership in a split.
- Wrestler names/IDs must not be duplicated after normalization.
- Every scheduled participant must exist in that match's league roster.

### Schedule validation

- A scheduled match must have two distinct wrestlers.
- Both wrestlers must belong to the scheduled league/split.
- Every regular league week must have six matches for a 12-person league.
- Every wrestler must appear exactly once in a league week.
- Booking-order numbers must be unique and complete within a show.
- No unordered pairing may appear twice in the same league/week.
- For the current workbook format, Weeks 1–11 must contain all 66 unique pairings and Weeks 12–22 must mirror those pairings once.
- `Next_Show` must match the corresponding `Matchup_Reference` rows exactly, including booking order.
- Missing authoritative matchup rows are errors; the system must not generate replacements.

### Result validation

- A result may only attach to an existing scheduled match.
- A match may have at most one active result.
- A decisive winner/loser must be the scheduled participants and must be distinct.
- A draw must have no winner and must award one point to each participant.
- A loss awards zero; a decisive win awards three; no bonus/penalty is applied without an explicit rule.
- `User`/`Simulation` maps to result source, not finish type.
- Unknown, no-contest, or unclear results must not be scored as normal league wins without a confirmed rule.
- Relegation DQ: the wrestler causing the DQ loses.
- Relegation no contest/unclear stoppage: the higher-league wrestler retains the place.
- A result reported for the wrong pairing or wrong expected show must be rejected/flagged pending confirmation.

### Standings and record validation

For each wrestler:

- `matches = wins + draws + losses`.
- `points = 3 × wins + draws` under the confirmed scoring rule.
- Matches cannot be negative or exceed the configured competition-format maximum.
- Wins, draws, or losses cannot exceed matches.
- Across a league, total wins must equal total losses for decisive matches.
- Across a league, the sum of wrestler match counts must equal twice the number of completed matches.
- Recalculated records must match imported `Standings_Current`; discrepancies are errors and must not be auto-corrected silently.
- League Year 2 rank must sort by points, then head-to-head, then longest winning streak; if still tied, flag a required tiebreaker match.
- For a tie involving three or more wrestlers, preserve the imported rank and warn when head-to-head ordering would require an undocumented aggregation method.
- A champion/promotion/relegation zone shown before completion must be treated as provisional unless clinching evidence exists.

### Tiebreak validation

- Detect tied point groups at all consequential boundaries.
- Apply the active League Year 2 order: points, head-to-head, longest winning streak, then a tiebreaker match only if still tied.
- Seed must not be used as an automatic tiebreak criterion.
- Require a tiebreaker match only when the active criteria remain tied and the tie affects champion, direct promotion, relegation, direct relegation, or Global Top 4 qualification.
- Do not invent a head-to-head aggregation formula for ties involving three or more wrestlers.
- Standard two-person tiebreak match validation uses Steel Cage No Escape with pinfall/submission only, unless a later authoritative change exists.
- Three-or-more-person tiebreaks remain invalid to auto-generate until a documented format is supplied.

### Promotion, relegation, and finals validation

- Direct promotion: lower Rank 1.
- Direct relegation: upper Rank 12.
- Relegation pairing: lower #2 vs upper #11, lower #3 vs upper #10, lower #4 vs upper #9.
- Regional cannot be relegated to a lower league; Global cannot be promoted to a higher league.
- League Finals must contain the documented six matches on each night.
- Global table champion and Elite Cup winner must remain separate achievements.
- Elite Cup semifinal pairing must remain pending-confirmation until the rule-source conflict is resolved.

### Current workbook baseline checks

The first automated test fixture should reproduce these already verified facts:

- 48 unique roster memberships.
- 528 scheduled regular matches.
- 312 completed and 216 open schedule rows.
- No invalid participant or winner references.
- No duplicate wrestler appearances within a league/week.
- No standings record or point mismatches across 48 wrestlers.
- 78 completed matches and 234 aggregate points per league after Week 13, with no draws.
- National Week 14 next-show matchups exactly match the six authoritative rows listed in the source workbook.

## 7. First implementation step

Create a **read-only TypeScript source-audit package** before any web UI.

The first implementation slice should:

1. Define the core domain and source-lineage types.
2. Read the workbook's populated rows for `Roster_Seeds`, `Year_Calendar_48W`, `Schedule_22W`, `Standings_Current`, `H2H_Tracker`, `Winning_Streaks`, `Next_Show`, `Matchup_Reference`, and `Schedule_Audit`.
3. Normalize workbook values without changing the source files.
4. Run the roster, schedule, result, and standings baseline validations listed above.
5. Emit a machine-readable audit report with stable error/warning codes.
6. Add unit tests for 3/1/0 scoring and fixture-based reconciliation of all 48 current standings rows.
7. Add explicit warnings for genuinely unresolved rules and stale table ranges; do not warn that the active League Year 2 calendar, double round robin, or tiebreak order conflicts with the historical PDF.

**Acceptance criteria for the first step:** the package can ingest the current master, report zero roster/schedule/result/points errors for the verified baseline, report only the remaining structural/rule warnings, and return the National League Week 14 matchups solely from the authoritative workbook reference. No UI, fixture generator, result editor, or workbook writer should be included yet.

## Phase 11.1C — Standings Layout Alignment Polish

- This phase is a pure UI polish pass; standings calculations, source reconstruction, week review flow, lock/promote behavior, dashboard data, and live standings data logic were intentionally left unchanged.
- Mini Standings Preview league cards now share equalized card structure and row spacing so the 2x2 preview grid feels balanced without awkward bottom dead space.
- The Dashboard Current User Table retains the Full Live Standings pill styling while removing the arrow from the link label.
- Full Live Standings league cards now stretch consistently within the 2x2 grid, use a standardized header/table structure, and reduce excess vertical space inside the cards.


## Phase 11.1D — Live Standings Alignment + Results Button Radius Fix

- This phase is UI-only and intentionally does not change standings logic, data-source logic, simulation logic, result logic, workflow logic, week-review logic, or dashboard logic.
- Full Live Standings league cards now keep a cleaner, consistent 2x2 grid so Global aligns with Continental and National aligns with Regional while preserving existing card sizing and spacing language.
- Result Entry winner selection boxes now use the site rounded-corner language.
- The Weekly Workflow action button on Result Entry now uses the same rounded-corner treatment while preserving its color, size, and placement.
