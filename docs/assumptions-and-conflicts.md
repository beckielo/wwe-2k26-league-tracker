# Assumptions and Conflicts

## Purpose

This document records contradictions, ambiguous fields, and deliberately unresolved decisions found during the initial source review. Nothing listed as **open** is to be implemented as a rule without confirmation or an authoritative source update.

## Source precedence used for this review

1. The Excel master workbook is authoritative for the **current** standings, results, schedule, roster, active split/week, next matchups, and active League Year 2 competition structure.
2. The current active Year-2 rules supplied with the workbook are authoritative for the League Year 2 tracker. This includes the 48-week calendar, two-split format, double round robin, and active tiebreak order.
3. The rulebook PDF remains authoritative for rules and special cases that have not been superseded by the active League Year 2 structure. Its old four-season, 13-week format is historical for this implementation.
4. `Matchup_Reference` and the workbook schedule are authoritative for matchups. The application must not derive or guess a replacement matchup.
5. The AI start-instruction text remains authoritative workflow guidance: expose contradictions and uncertainty rather than silently overwriting source data.
6. Chat context and plausible interpretations are not authoritative sources unless the user explicitly confirms a current rule, as in the League Year 2 corrections recorded here.

## Confirmed current-data interpretation

The current master is **League Year 2, Opening Split, after completion of Week 13**. For the current tracker implementation, League Year 2 has 48 weeks: the Opening Split occupies Year Weeks 1–24 and the Closing Split occupies Year Weeks 25–48. Each split has 22 regular league weeks, split Week 23 as a tiebreaker week if needed, and split Week 24 as League Finals. Each 12-wrestler league runs six matches per regular week; every wrestler faces every other wrestler twice per split, with Weeks 12–22 forming the return round (Rückrunde). These are active implementation rules, not provisional interpretations.

The next user show is National League, Opening Split Week 14. Its six matchups are explicitly listed in `Next_Show`, `Schedule_22W`, and `Matchup_Reference`; they must be read from those sources rather than regenerated.

## Conflicts and unclear points

### C-001: Season/split structure differs between the current workbook and old rulebook — resolved for League Year 2

- **Historical PDF structure:** four seasons per Universe year; each season has 13 weeks: Weeks 1–11 round robin, Week 12 tiebreakers, and Week 13 League Finals.
- **Active League Year 2 structure:** one 48-week League Year with an Opening Split in Year Weeks 1–24 and a Closing Split in Year Weeks 25–48. In each split, Weeks 1–22 are regular league weeks, split Week 23 is the tiebreaker week if needed, and split Week 24 is League Finals.
- **Resolution:** the current workbook and active Year-2 rules supersede the PDF's old 13-week structure for the current tracker implementation. The historical structure must not drive League Year 2 validation, routing, labels, or event generation.
- **Status:** **resolved for current implementation**.

### C-002: Round-robin match count differs — resolved for League Year 2

- **Historical PDF structure:** each 12-wrestler league runs a single round robin, producing 11 matches per wrestler.
- **Active League Year 2 structure:** each split uses a double round robin. Every wrestler faces each of the other 11 wrestlers twice, producing 22 matches per wrestler. Each league has six matches per regular week; Weeks 1–11 are the first round and Weeks 12–22 are the return round (Rückrunde).
- **Resolution:** League Year 2 schedule and record validation must use 22 regular matches per wrestler per split and 132 regular matches per league per split. Matchups still come from the workbook schedule and `Matchup_Reference`; the application must validate, not regenerate, them.
- **Status:** **resolved for current implementation**.

### C-003: Tiebreaker hierarchy differs from the old rulebook — resolved for League Year 2

- **Historical PDF structure:** relevant tied positions proceed to decision matches without defining the active Year-2 pre-match hierarchy.
- **Active two-wrestler order:** (1) points, (2) head-to-head, (3) longest winning streak, and (4) a tiebreaker match if still tied.
- **Active multi-wrestler order (Phase 8.1):** (1) points, (2) longest winning streak, then (3) head-to-head only inside a remaining clean two-wrestler subgroup. Aggregate multi-man head-to-head mini-table formulas are not used unless explicitly documented later.
- **Resolution:** seed never resolves a tie. A multi-man group fully separated by longest winning streak is `Resolved by Winning Streak`; a clean two-person streak subgroup may be `Resolved by Head-to-Head`. Remaining groups require a tiebreaker recommendation/status only, without fixture generation.
- **Recommended unresolved formats:** three wrestlers use `Triple Threat Tiebreaker`, four use `Mini-Tournament` (semifinals + final), five use `Fatal 5-Way Tiebreaker`, and six use `Review Required` unless an explicit rule/template is added.
- **Outcome handling:** draws end winning streaks. No Contest and unclear outcomes remain excluded from H2H/streak formulas unless authoritative workbook/app result rules encode them otherwise.
- **Source boundary:** without an authoritative Week 23 schedule or matchup template, the application reviews and labels ties but does not generate fixtures.
- **Status:** **resolved by the Phase 8.1 multi-man tiebreaker rule update**.

### C-004: Global Elite Cup semifinal seeding is explicitly open in the rulebook but fixed in the workbook template

- **Rulebook:** the exact semifinal seeding is “to confirm”; `#1 vs #4` and `#2 vs #3` must not be assumed automatically.
- **Workbook `PPV_Template_Layout`:** Night Two specifies `Global #1 vs Global #4` and `Global #2 vs Global #3`.
- **Impact:** generation and validation of Elite Cup fixtures.
- **Current handling:** treat the workbook layout as a proposed/current template, not a universally active rule, until explicitly confirmed in the authoritative rulebook/change log.
- **Status:** **open**.

### C-005: Normal league match type is unspecified

- **Rulebook:** normal round-robin match types must be checked in Excel/Universe setup and are explicitly listed as an open point.
- **Workbook:** regular schedule rows contain participants, winners, and a column labeled `Result Type`, but populated values are `User` or `Simulation`; no normal match stipulation is recorded.
- **Impact:** match-detail display and match-type validation cannot be authoritative.
- **Current handling:** model normal match stipulation as nullable/unknown. Do not display a guessed stipulation.
- **Status:** **open**.

### C-006: `Schedule_22W.Result Type` contains result source, not finish type

- **Workbook header:** `Result Type`.
- **Workbook values:** `User` and `Simulation`, which describe how the result was produced, not whether it ended by pinfall, submission, draw, DQ, or no contest.
- **Impact:** the current workbook cannot distinguish finish types needed for draws and special-case validation.
- **Current handling:** ingest this field as `resultSource` with a source-field warning. Keep `finishType` nullable until a real source exists.
- **Status:** **schema ambiguity**.

### C-007: Draw, DQ, and no-contest storage is not demonstrated by current data

- **Rulebook:** draws award one point to each wrestler; relegation DQ and no-contest outcomes have special handling.
- **Current workbook:** all 312 completed regular matches through Week 13 have one participant in the `Winner` field. No current row demonstrates how draw, DQ, no contest, or unclear abandonment would be encoded.
- **Impact:** import behavior for these outcomes cannot be inferred safely from existing rows.
* **Current handling:** Phase 3A supports browser-local confirmed results for Winner, Draw, and No Contest. Winner results update browser-local standings with a win/loss and 3/0 points. Draw results award one point to each wrestler. No Contest is stored but does not affect standings until an authoritative rule is confirmed. The workbook is not mutated. DQ and unclear-result encoding remain unresolved until the workbook/rulebook defines their exact representation.
* **Status:** **open data-encoding question; Phase 3A local handling is resolved, Excel export remains disabled**.

### C-008: Some Excel table ranges do not cover all populated rows

- `H2H_Tracker` has 312 populated result rows plus its header, while the named Excel table covers only `A1:G265`.
- `Changelog` contains populated rows beyond the named table range `A1:D5`.
- **Impact:** an importer that reads only named table ranges would omit valid workbook content.
- **Current handling:** initial ingestion must inspect populated worksheet rows and report named-table range drift. It must not silently discard rows outside a table.
- **Status:** **confirmed structural issue**.

### C-009: Current `Status / Zone` labels read as final despite the split being in progress

- **Workbook state:** Week 13 of 22 league weeks is complete.
- **Standings labels:** rows already use terms such as `Champion + Elite Cup`, `Champion + direkter Aufstieg`, and `Direkter Abstieg`.
- **Impact:** a UI could incorrectly present provisional current positions as clinched outcomes.
- **Current handling:** preserve the source text, but label it as a **current/provisional zone** unless a future source explicitly marks a place as mathematically clinched.
- **Status:** **presentation ambiguity**.

### C-010: Historical Beckielo placement differs from current placement but is not a current conflict

- **Rulebook historical statement:** Beckielo starts Season 1 in the Regional League as Seed 12 and replaces Tommaso Ciampa.
- **Current workbook:** Beckielo is in National League as Seed 8 for League Year 2 Opening Split.
- **Handling:** this is treated as progression between historical and current states, not a contradiction. The workbook controls the current roster.
- **Status:** **resolved by source scope**.

### C-011: Legacy rules are present in the workbook but absent from the rulebook v1.0

- **Workbook:** defines active legacy categories and a GOAT weighting, including Double, Invincible Split, Global Champion wins, Elite Cup wins, and streak metrics.
- **Rulebook:** says additional legacy points/statistics are optional and inactive unless explicitly introduced.
- **Impact:** implementing legacy rankings would introduce a ruleset whose authority/version is unclear.
- **Current handling:** preserve legacy workbook data for later display/import work, but defer calculated GOAT/legacy logic until its authority and formulas are confirmed.
- **Status:** **open rule-version conflict**.

### C-012: Phase 2B simulation persistence and weighting

* **Confirmed scope:** only non-user-controlled leagues with open matches in the first open scheduled week are eligible. The user league is read from workbook metadata and excluded.
* **Match authority:** a simulation candidate must exist in both `Schedule_22W` and `Matchup_Reference`; no fixture is generated or repaired.
* **Weighting:** simulation uses seed/prestige, current standing, points, current winning streak, longest winning streak, a bounded upset chance, and a 1% draw chance. These weights are an application simulation model, not a claim that the workbook or rulebook defines exact probability formulas.
* **Persistence:** Phase 2B originally stored simulation previews in browser `localStorage`. Phase 3A promotes confirmed previews into the shared versioned tracker-state overlay under C-013. The workbook and server snapshot remain read-only and unchanged.
* **Special outcomes:** Draw and No Contest may be confirmed in local tracker state and JSON backup, but they are not mapped back into Excel because workbook encoding remains unresolved under C-007.
* **Status:** **resolved for browser-local simulation and confirmation behavior; workbook export remains out of scope**.

### C-013: Phase 3A local confirmed-result state

* **Snapshot boundary:** the Excel workbook remains the authoritative baseline through completed Week 13. Phase 3A confirmations are a separate versioned browser-local overlay and never overwrite workbook cells.
* **Completion:** the first open scheduled week may be completed only when all 24 authoritative schedule rows have one valid confirmed result. Completion locks that week; unlocking requires an explicit warning.
* **Standings overlay:** Winner adds one match, one win/loss, and 3/0 points; Draw adds one match and one draw to each wrestler and one point each. No Contest is accepted as a confirmed completion outcome but does not change matches or points because the normal-league workbook encoding/effect remains unresolved.
* **Ranking display:** app-state standings sort by updated points and preserve workbook order for equal points. Full H2H/streak re-ranking after newly confirmed app results is deferred until app-state H2H/streak overlays are implemented.
* **Persistence:** confirmed results, completed-week locks, and import/export timestamps use browser `localStorage`. JSON export/import is the portable backup; there is no database or workbook write.
* **Status:** **resolved for Phase 3A local workflow; workbook export and permanent storage remain out of scope**.

## Verified data-quality observations

The following checks found no current-data conflict:

- 48 roster rows: 12 unique wrestlers in each of four leagues, with seeds 1–12 and no duplicate wrestler names.
- 528 regular schedule rows: four leagues × 22 weeks × six matches.
- Every wrestler appears exactly once in each league/week schedule.
- Weeks 1–11 contain 66 unique pairings per league; Weeks 12–22 mirror those opponents for the return round.
- 312 result rows are complete through Week 13; 216 future rows are open.
- Every populated winner is one of the two scheduled participants.
- Recalculated matches, wins, draws, losses, and points agree with all 48 rows in `Standings_Current` using 3/1/0 scoring.
- Per league after Week 13: 78 completed matches, 78 wins, 78 losses, no draws, and 234 aggregate points.
- The workbook's own `Schedule_Audit` reports all structural schedule checks passing, including the corrected Week 13/14 ordering.

## Decisions intentionally not made

- Whether future league years retain the active League Year 2 48-week/two-split format; League Year 2 itself is resolved.
- The exact head-to-head calculation for ties involving three or more wrestlers.
- Whether Elite Cup semifinals are permanently seeded `#1 vs #4` and `#2 vs #3`.
- The match type for ordinary league matches.
- The exact multi-person tiebreak format.
- How draws, DQ, no contest, and unclear stoppages are encoded in the Excel master.
- Whether current zone labels represent projections or clinched outcomes.
- Whether workbook-only legacy/GOAT calculations are active authoritative rules.
## Phase 3B — week progression workflow

* **Active week detection:** the app starts with authoritative workbook match rows whose status is `scheduled` and whose week is later than the workbook's completed-through week. The first such week not present in the browser-local `completedWeeks` locks is the active app week. No fixture is generated to fill a missing week.
* **Local-only progression:** completing and locking a week advances the browser workflow to the next authoritative scheduled week. This does not alter the workbook's current-week metadata or any workbook cell.
* **Completion state:** an active week is `incomplete` until all 24 authoritative scheduled matches have one valid confirmed result; it is `complete-unlocked` when those checks pass; and a completed-week entry makes it `locked`. A No Contest counts as a confirmed result but continues to have no standings effect under the existing Phase 3A handling.
* **Locked-week behavior:** locked weeks reject result edits and removals. Week Review offers an explicit warning-confirmed unlock action; unlocking an earlier week returns it to the active workflow before later weeks.
* **Simulation boundary:** simulation is restricted to open, authoritative non-user-league matches in the active app week. Browser-confirmed matches are excluded, and the workbook-defined user-controlled league remains ineligible.
* **Persistence compatibility:** Phase 3B keeps tracker state version 1 and the existing JSON export/import format. Existing confirmed results, completed-week locks, and timestamps remain usable.
* **Season complete behavior:** if every later authoritative scheduled week is locked, the workflow reports that no active week remains. It does not invent a subsequent card or infer League Finals fixtures.

## Phase 10.2 — workflow CTA and simulation preview cleanup

* **CTA consolidation:** the active workflow action cluster exposes one primary user-league result-entry action. It does not repeat a secondary Result Entry link to the same route; Simulation and Week Review remain separate actions.
* **Active simulation schedule:** Simulation resolves the browser-local active workflow before building previews. When Closing Split Week 1 is active, the accepted generated or imported schedule snapshot is authoritative, so workbook Week 25 rows are neither required nor invented.
* **Simulation scope:** previews exclude the active workflow's user-controlled league and include only open non-user matches for the active split week. Accepted snapshots are validated before activation and therefore do not require a duplicate legacy `Matchup_Reference` row.
* **Profile continuity:** when post-finals movement changes a wrestler's league, simulation reuses that wrestler's unique workbook-derived rating inputs while the accepted snapshot supplies the authoritative new matchup and league assignment.
* **User-facing naming:** Simulation uses split-relative labels such as `Closing Split Week 1`; `League Year 2 · Year Week 25` is secondary metadata. Old internal phase labels are hidden from the user-facing page.
# Phase 9 — League Finals Module

- Phase 9 derives Week 24 League Finals from the final resolved Opening Split standings. It covers league champions, direct promotions/relegations, the nine relegation matches, the Global Elite Cup qualified field/card, browser-local League Finals result entry, and guarded Night One/Night Two completion.
- `PPV_Template_Layout` is the authoritative current-master source for the two-night card. Its relegation slots match the active League Year 2 rules, and its explicit Global Elite Cup semifinals (`Global #1 vs #4`, `Global #2 vs #3`) are used and labeled as source-template derived. If that sheet is absent, the app lists only the qualified Top 4 and marks the semifinal card **Review Required** rather than assuming seeding.
- The current regular result model does not identify who caused a disqualification. Phase 9 therefore does not offer a DQ result encoding and displays **Review Required**. Relegation `No Contest / unclear` is supported separately and retains the higher-league wrestler, as specified by the source template.
- The authoritative template supplies six matches per night. No filler is generated. If the game requires additional matches, the UI displays **Manual card padding required**.
- League Finals event results are kept separately from regular league-week results in browser-local tracker state. They do not alter regular scoring, simulation, fixtures, or workbook writeback.
- Phase 9B/Post-Finals Transition is explicitly out of scope. Completing both finals nights does not create Week 25, start the Closing Split, or create new league rosters; it only displays: “League Finals complete. Next step: Phase 9B Post-Finals Transition.”

# Phase 9B — Post-Finals Transition Module

- Phase 9B unlocks only after both League Finals nights are marked complete, every authoritative finals match has one valid result, consequential tiebreaker states are resolved, and the resulting roster has 48 unique wrestler assignments with exactly 12 wrestlers per league.
- Direct promotions and relegations are applied from final ranks before/alongside the nine source-derived relegation outcomes. A relegation winner occupies the higher league and the loser occupies the lower league. A No Contest/unclear ending retains the original higher- and lower-league assignments.
- The current League Finals result schema does not identify the wrestler who caused a DQ. A DQ/unsupported ending therefore remains **Review Required** and cannot automatically unlock Closing Split setup.
- Post-finals ordering is only a **Proposed seed order / Review Required** view. It uses objective prior league tier, final prior rank, finals outcome, and champion/direct-promotion status; existing seed is never used to resolve a tie. Ordering ambiguity does not invalidate an otherwise valid league composition, but an unconfirmed order cannot activate schedule creation that requires final seeds.
- Closing Split Week 25 fixtures may not be generated or activated without an authoritative Closing Split schedule or template. If none exists, the module reports: “Closing Split schedule source missing: create or import schedule before starting Week 25.”
- History storage is fact-only: champions, Elite Cup winner/runner-up, direct movement, relegation outcomes, successful retention, and unambiguous undefeated/Beckielo facts. Workbook legacy data is preserved as factual history, while GOAT points and subjective rankings remain disabled under **Legacy formula Review Required**.
- Phase 9B remains browser/read-only with respect to the original workbook. It does not bypass the Phase 7 promote/finalize workflow and does not automatically start the normal Week 25 workflow.

# Phase 9.5 — Year Rollover, Seed Continuity, Schedule Readiness, and History Sync

- Phase 9.5 is the continuity gate between a completed split and the next Closing Split or League Year. It reports current year/split completion, League Finals completion, Phase 9B composition validity, seed readiness, schedule readiness, factual history, and the next allowed action. It does not mutate the original workbook or bypass the safe promote/finalize workflow.
- **Confirmed seed rule:** “Seeds are derived from the final standings of the previous completed split after post-finals league composition is calculated.”
- Seed ordering first uses the new league membership produced by Phase 9B, then previous league tier, final rank in the previous completed split, and a relevant League Finals head-to-head result when two wrestlers directly competed for the same league place. Alphabetical wrestler name is the deterministic final fallback for seed/order generation only.
- Seed is never a standings or tiebreaker resolver. Alphabetical order is never used to resolve standings, championships, promotion, relegation, tiebreakers, match results, or any other competition outcome. No subjective WWE prestige ranking is introduced.
- Schedule activation requires an authoritative workbook schedule/template or a documented generator whose output passes the full 22-week double-round-robin validation: 12 wrestlers per league, 22 regular weeks, six matches per league/week, every pairing twice, and every wrestler appearing exactly once per week. Without such a source, the gate reports: “Schedule source missing: create/import schedule before starting the next split.”
- Normal Week 25 and new League Year Week 1 workflows remain locked until League Finals, Phase 9B composition, proposed seeds, and schedule readiness are all valid. Phase 9.5 validates supplied fixtures and never guesses missing matchups.
- History persistence is fact-only: league champions, Elite Cup winner/runner-up when available, direct promotions/relegations, relegation winners/losers, successful retentions, unambiguous undefeated splits, and Beckielo’s final league/rank/movement when present. GOAT points and subjective legacy rankings remain inactive unless an explicitly authoritative formula is supplied; the UI reports **“Legacy formula Review Required — facts preserved only.”**

## Phase 9.6 — Schedule Generator / Importer

- League Year 2 uses a **22-week double round robin** in each split: Weeks 1–11 are the Hinrunde and Weeks 12–22 repeat the same pairings as the Rückrunde with wrestler order reversed. Each of four 12-wrestler leagues has six matches per regular week and 132 matches per split (528 total).
- The generator uses a deterministic circle-method template over seed slots 1–12, then maps each Phase 9.5 seeded league roster onto that shared template. Seeds provide schedule order only and never resolve standings or tiebreakers.
- JSON imports use the generated schedule schema, normalize league and wrestler names case-insensitively against the Phase 9B composition, and pass through the same complete structural validator as generated schedules.
- Validation checks league/roster counts, Weeks 1–22, six matches per week, wrestler appearances, both legs of every pairing, match IDs, self-matches, total counts, unknown wrestlers, and overlap with locked played weeks. Any failure is **Review Required** and blocks acceptance and next-week activation.
- Generated and imported schedules are preview-only until Phase 9B is valid, Phase 9.5 seeds are valid, structural validation passes, and the local user explicitly accepts/promotes the snapshot. Acceptance records source, versions, sources, timestamp, target year/split, and validation metadata.
- An accepted snapshot is a separate app-state/export artifact. It does not mutate the original Excel workbook and never overwrites already-created or already-played workbook schedules or results. Closing Split Week 1 (Year Week 25) or a new League Year Week 1 remains blocked until the correctly targeted schedule snapshot is accepted; acceptance does not auto-start or auto-lock a week.

## Phase 9.6.1 — Schedule Acceptance, Persistence, and Feedback

- A generated or imported preview is transient and is **not authoritative**. It can be promoted only by an explicit **Accept / promote snapshot** click after Phase 9B Transition, Phase 9.5 seeds, all 528 fixtures, schedule validation, and blocking Manual Review checks are ready.
- Acceptance is blocked when no preview exists, validation is not valid, a blocking Manual Review is open, either prerequisite phase is not ready, or an existing accepted snapshot has not been explicitly approved for replacement. The Schedule Setup UI displays the applicable blocking reason instead of silently disabling the action.
- The accepted snapshot is persisted in the existing browser tracker state and displayed separately from any transient preview. It records acceptance time, target league year and split, match count, validation status, source, and the available generator/importer version.
- After explicit acceptance, the persisted snapshot becomes the schedule source for the next split/year and makes the applicable Week 25 or new-year Week 1 activation available. Acceptance does not start a week, lock a week, mutate the source workbook, or bypass the existing safe promotion/finalization workflow.
- Reloading before acceptance may discard the transient preview; in that case the UI reports that no preview exists. Reloading after acceptance retains the accepted snapshot and activation readiness without requiring schedule regeneration.

## Phase 9.7 — Manual Review, History, and Rulebook UI

- Standard result entry is deliberately winner/loser only. The tracker does not require or infer Pinfall, Submission, DQ, Countout, No Contest, or any other finish type for a normal match.
- Special circumstances are recorded only when the user explicitly opens **Manual Review / Unclear Result** and supplies a note. The review preserves league, week/event, matchup, wrestlers, note, creation time, status, and resolution time.
- Manual Review does not invent a winner, loser, finish type, score, or rule outcome. It is not a result type, scoring rule, standings input, or tiebreaker.
- An open review blocks the affected show/week lock or League Finals night and also blocks Post-Finals Transition, Year Rollover, and schedule activation. The user must save a valid normal winner/loser before resolving, or explicitly clear the review.
- The History / Legacy Facts dashboard is fact-only. It may display completed champions, Elite Cup results, direct movement, relegation outcomes, retention, Beckielo facts, or an undefeated split only when app/workbook-derived data proves them. Missing achievements are not invented.
- GOAT scores, power rankings, prestige points, and subjective legacy formulas remain inactive unless an explicitly authoritative formula is approved.
- The Rulebook / Changelog page is read-only. It summarizes active rules and source hierarchy and points to this conflict register for traceability; it cannot modify workbook or app rules.
- **Status:** implemented for Phase 9.7 browser-local workflow; the original workbook remains unchanged.
# Phase 9.6.2 — accepted schedule activation

- A generated or imported schedule remains only a preview/accepted browser-local snapshot until the user explicitly selects **Start Closing Split / Activate Week 25**.
- Week 25 activation is explicit and browser-local. It does not mutate, promote, finalize, or otherwise change the original Excel workbook.
- After activation, the accepted League Year 2 Closing Split snapshot is the authoritative schedule source for the active weekly workflow beginning at Year Week 25 / Split Week 1.
- Opening Split completion, League Finals, post-finals transition, year-rollover facts, accepted-snapshot metadata, prior results, and prior locks remain preserved. Activation creates no results and locks no show or week.

## Phase 10 — Professional Design, UI & UX Overhaul

- Phase 10 changes presentation, navigation, display mapping, and workflow guidance only. It does not change scoring, standings, tiebreakers, movement, League Finals, schedule generation, result validation, locks, or workbook safety behavior.
- User-facing primary week labels are split-relative. Opening Split uses Weeks 1–24; Closing Split uses Weeks 1–24. Closing Split Year Week 25 is displayed primarily as **Closing Split Week 1**.
- Year Week remains internal continuity metadata and may be shown only as secondary context, for example: **League Year 2 · Year Week 25**.
- The governing UX principle is: **“The UI should guide the user to the next valid action and explain locked states clearly.”**
- Actions remain explicit. The overhaul does not auto-start a week, auto-finalize a show, mutate the source workbook, or infer a missing fixture or rule.
