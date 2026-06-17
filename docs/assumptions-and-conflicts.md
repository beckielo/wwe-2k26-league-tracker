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

## Phase 10.5 — Visual Identity, Interactive Polish & Live Standings

- Phase 10.5 is a display-only design upgrade. It does not alter scoring, tiebreakers, promotion/relegation, League Finals, schedule generation, result calculations, workbook writeback, or workbook safety behavior.
- `/live-standings` is the quick-view live table for all four leagues. It starts from the authoritative workbook standings and applies only confirmed browser-local results through the existing standings projection; it does not infer fixtures, outcomes, or tiebreakers.
- The live page identifies whether its active schedule context is the workbook or an explicitly accepted generated/imported schedule snapshot and displays the active split, split week, user league, and latest available lock/update timestamp.
- League visual identities are intentionally restrained accents: Global uses gold/deep red, Continental uses silver/steel blue, National uses bronze/red-orange, and Regional uses green/graphite.
- Placement styling is presentational: ranks 1, 2, 3, and 4 have distinct classes; ranks 5–8 share a mid-table class; and ranks 9, 10, 11, and 12 each have distinct danger classes. Labels describe broad position context and do not claim a place is mathematically clinched.
- All new crests, belt plates, shields, table marks, and navigation pictograms are original SVG/CSS motifs. Official WWE, WWE 2K, 2K, or other trademarked logos are not copied or introduced unless a separately authorized existing repository asset is explicitly designated for use.
## Phase 10.6 — brand assets, Live Standings visibility, and interaction polish

- The project-specific league logo slots are `/public/brand-assets/leagues/global-league.jpg`, `continental-league.jpg`, `national-league.jpg`, and `regional-league.jpg`. League colors, short labels, fallback crests, and primary/secondary/ambient usage levels are centralized in `src/domain/brand-assets.ts`.
- The League Finals event slots are `/public/brand-assets/events/league-finals-night-one.jpg` and `league-finals-night-two.jpg`. They are limited to Finals-related presentation.
- These files were not present during implementation. Every image therefore has an in-component error fallback to the established crest/monogram and league color system; a missing image cannot block rendering, tests, or the production build.
- `/public/brand-assets/decorative/` is optional and may be absent or empty. No runtime scan or required import depends on it. CSS gradients, borders, masks, and restrained geometric motifs provide the fallback atmosphere.
- Only user-provided, project-specific assets are registered. No official WWE, WWE 2K, or 2K logo was copied or generated.
- Large/primary artwork is reserved for major identity surfaces (the active Dashboard league, each Live Standings league panel, and each Finals night). Repeated identity uses compact cropped marks, color bars, or fallbacks to avoid sticker-like repetition.
- Live Standings remains a dedicated `/live-standings` route, is visible in the main Competition navigation, has an `Open Live Table` Dashboard shortcut, and is linked from the detailed `/standings` page.
- Placement styling remains presentation-only: ranks 1, 2, 3, and 4 have distinct gold, cyan/silver, bronze/blue, and purple treatments; ranks 5–8 share graphite; ranks 9, 10, 11, and 12 have distinct amber, orange, red-orange, and deep-red treatments. Existing standings and league-rule calculations were not changed.
- Shared `radius-sm`, `radius-md`, `radius-lg`, and `radius-xl` tokens now cover controls, cards, tables, forms, expandable panels, major hero panels, and Finals panels. Clickable panels and enabled controls receive hover, focus, shadow, and pressed feedback; disabled controls retain no lift and a `not-allowed` cursor.

## Phase 10.6.1 — brand polish, warning language, and logo cropping

- Brand usage now has explicit `hero`, `panel`, `watermark`, `header`, `crest`, `compact`, and `micro` modes. Full poster-style league artwork is limited to hero, panel, header, and watermark contexts.
- Full square league/event logos must not be compressed into tiny foreground badges. Crest, compact, and micro modes render readable league-color monograms instead: Global League `GL`, Continental League `CL`, National League `NL`, and Regional League `RL`.
- Live Standings uses one compact monogram crest in each league header and at most one subdued full-art watermark behind it. Dashboard foreground marks use the same compact crest system while the active league artwork remains a low-opacity large watermark.
- League Finals full Night One and Night Two artwork remains limited to the larger event panels. Compact event labels use text or the existing `N1` / `N2` fallback identity rather than miniature poster thumbnails.
- Dashboard validation items with warning severity are presented as **Source Warnings** or **Historical / Non-blocking**, not errors. They remain summarized/collapsed with “Non-blocking · details contained”; only error-severity validation issues are presented as blocking issues.
- “Blocked” is reserved for a workflow that cannot continue. An available current card is labeled `Ready` before its first result and `In Progress` after results are recorded; an incomplete card is not itself treated as blocked.
- Phase 10.6.1 changes presentation and status-label mapping only. It does not alter workbook data, scoring, standings, schedules, result entry, simulation, Finals, promotion/relegation, rollover, or writeback safety.
# Phase 10.6.2 — Decorative Asset Integration & Match Preview Overhaul

- Original user-provided league and League Finals images remain the primary assets for large identity contexts. Decorative art supports those originals and does not replace them.
- Dedicated `deco-*-batch.png` assets now provide compact league badges. Full poster-style league and event images must not be rendered as tiny badges.
- Decorative league, event, and GWF assets are optional presentation layers with image-error fallbacks. They are used as masked, darkened, low-opacity environmental art rather than authoritative data.
- The Schedule match preview reads only existing authoritative `Match` records and exposes split, split week, league, bout, wrestlers, show day, round, and source context. Its controls only browse the supplied card and do not generate matches.
- The Dashboard remains compact and workflow-focused. It receives one controlled decorative hero accent but does not host the full match-preview experience.

## Phase 10.7 — Legacy Table Visibility & Journalist Commentary

- The workbook `Legacy_Tracker` sheet is the sole source for the restored `/legacy` table. Every existing workbook column is preserved: wrestler, current league, source GOAT status tier, league wins, Global Champion wins, Elite Cup wins, doubles, invincible splits, invincible Hinrunden, invincible Rückrunden, longest overall win streak, and the original journalist/GOAT note.
- `/legacy` is linked directly from both the Dashboard and main navigation. The separate `/history` fact archive remains available and unchanged.
- The source workbook's existing tier and row order are displayed as source data. Phase 10.7 does not create a new GOAT score, reorder the source table with a new formula, or change league rules.
- New journalist commentary is derived only from populated legacy fields and optional, explicitly supplied historical checkpoints. Supported signals include recorded titles, Global titles, Elite Cup wins, doubles, winning streaks, invincible split/Hinrunde/Rückrunde runs, current league, and checkpoint-based improvement or decline.
- Commentary categories are selected by a deterministic weighted priority model. Current categories include Dominant Champion, Elite Cup Specialist, Streak-Based Threat, Invincible Run Candidate, Hinrunde Dominance, Rückrunde Surge, Late-Season Collapse, Split-to-Split Improvement, Year-to-Year Legacy Growth, Global League Mainstay, and Lower League Climber.
- Text and voice selection are deterministic for the complete source profile: a reload with unchanged stats returns the same comment, while a relevant source-stat change updates the output on the next render. No random reload behavior is used.
- Evidence pills are emitted only for facts present in the profile. Missing titles, cups, promotions, relegations, finals, placements, or historical checkpoints are never inferred or mentioned as achievements.
- The commentary input supports Hinrunde, mid-split, final, previous-split, and previous-year placements when authoritative checkpoint data becomes available. The current workbook does not expose those checkpoints in `Legacy_Tracker`, so Phase 10.7 does not fabricate or display them.

## Phase 10.7.1 — Legacy Table UI Polish & Journalist Commentary Depth

- A commentary category is presentation metadata, not the full analysis. Every derived commentary record now keeps the category and full-sentence journalist copy as separate fields, with a compact excerpt for the ranking row and the complete analysis in the selected-wrestler panel.
- Derived commentary is deterministic for the same wrestler and stat profile. Wording variation is selected from stable wrestler/stat inputs; it does not use randomness and changes only when relevant recorded inputs change.
- Every wrestler receives at least one complete sentence. Profiles with enough recorded achievement receive two or three sentences that combine the primary legacy marker with a secondary, independently available statistic.
- Commentary may mention only populated workbook-backed fields or explicitly supplied checkpoint data. Missing titles, cups, invincible runs, streaks, promotions, relegations, or historical placements are never inferred.
- Category priority is: Global Championship history, league titles, Elite Cup results, invincible full-split evidence, half-split evidence, meaningful streaks, checkpoint decline/improvement, then current-league context. A title or trophy therefore outranks generic streak commentary, and `Streak-Based Threat` is reserved for profiles where the streak is genuinely the strongest recorded marker.
- The Legacy ranking keeps every Phase 10.7 source metric, groups columns into identity, championship, form, and analysis sections, and uses horizontal scrolling rather than deleting dense statistics. Rows show category plus an excerpt; selecting a wrestler opens the full source-labelled analysis, stat callouts, and evidence tags.
- The Dashboard keeps its workflow-first hierarchy while giving `/legacy` a premium, full-width CTA with `GOAT / Legacy Rankings`, `Open Legacy Table`, `Career Archive`, and a compact workbook-backed teaser for the current first-ranked profile and recorded winner counts.

## Phase 10.8 — Closing Split active standings reset

- Active standings are split-scoped. Opening Split active tables include Opening Split results only; Closing Split active tables include Closing Split results only.
- The Closing Split active table starts from 0 matches, 0 wins, 0 draws, 0 losses, and 0 points before Closing Split Week 1 / Year Week 25 results are applied.
- Year Week 25 is treated as Closing Split Week 1, Year Week 26 as Closing Split Week 2, and so on for active split display labels.
- Previous split standings remain historical source data and may still be used for seed/order logic where the rulebook requires it, but previous split points must not carry into active Closing Split standings.
- Legacy and History views may aggregate historical data when explicitly labeled as legacy/history/year archive data. Active standings, Week Review, weekly close exports, and Live Standings must not use legacy or prior-split totals as current split points.
- Phase 10.8 does not change 3/1/0 scoring, workbook source data, result entry, simulation, week locks, or safe workbook writeback behavior.

# Phase 10.8.1 — active week advancement, schedule sync, and safe export availability

- After a regular week is completed and locked, that locked week becomes archive/export/writeback source only; it must not remain the active Dashboard, Result Entry, Simulation, Schedule, or Week Review card.
- Closing Split week mapping is fixed as Split Week 1 = Year Week 25, Split Week 2 = Year Week 26, continuing through Split Week 22 = Year Week 46.
- When Closing Split Week 1 / Year Week 25 is locked, local workflow state advances to Closing Split Week 2 / Year Week 26 while preserving locked Week 25 results and split-scoped Closing Split standings.
- Dashboard, Schedule, Full Schedule, Result Entry, Simulation, Week Review, Safe Workbook Update, Weekly Close Package, and Promote Current Master must derive active card display and latest locked week from the same browser-local tracker state plus the accepted schedule snapshot.
- Once a Closing Split schedule snapshot has been accepted and activated, the accepted generated/imported snapshot is the authoritative schedule source for Closing Split workflow pages; pages must not fall back to Opening Split workbook rows for active Closing Split cards.
- A complete, valid locked week is immediately exportable. Close package JSON, weekly results CSV, and app-state standings CSV are available for the latest locked week (for example, locked Year Week 25 / Closing Split Week 1) and do not require the next active week to be completed.
- Safe Workbook Update availability is based on the latest complete and valid locked app-state week plus the normal safe writeback checks. Before workbook writeback, the source workbook may still be completed through an earlier week, but the local overlay can still produce a safe updated workbook for the validated locked week.
- Promote Current Master remains subject to the existing branch/main and updated-workbook safety checks, but it must not be blocked by a stale “Latest locked week: None” state when the tracker has a valid locked week.

## Phase 10.8.2 — Closing Split schedule writeback and promotion authority

- The accepted generated/imported League Year 2 Closing Split schedule snapshot is the authoritative app schedule for Closing Split before workbook writeback. It is not a guessed or regenerated schedule, and validation must continue to compare locked results by match id and matchup identity.
- Safe Workbook Update must write the accepted Closing Split schedule snapshot into the updated workbook as `App_Accepted_Schedule` for Year Weeks 25–46, preserving League Year 2, Closing Split, split week, year week, league name, match ids, and matchup metadata.
- After Safe Workbook Update, the updated workbook schedule is authoritative for Closing Split promotion and future Closing Split validation. Promote Current Master must not validate Year Week 25+ against a stale original workbook schedule that has no Closing Split rows when an accepted/written schedule is available.
- If Year Week 25+ is being written or promoted without an accepted Closing Split schedule snapshot, the blocking reason is schedule writeback failure: “Accepted Closing Split schedule could not be written to workbook,” not a silent bypass of schedule validation.
- Schedule validation is not bypassed. Week results must still be complete, must contain exactly the expected scheduled match ids, must match the scheduled wrestlers/leagues/weeks, and invalid or incomplete Closing Split result packages must still fail promotion.

## Phase 10.8.3 — Live Standings Zone Mapping & Legacy Sync Fix

- Current master/workbook state is authoritative for active live standings, current results, current records, active split/week metadata, and Legacy sync. Browser-local overlays are applied only when they are newer than the workbook/app baseline and validate against the authoritative schedule.
- Accepted generated schedule snapshots are schedule authority only. They must not overwrite or reset current workbook/app standings or already-recorded Closing Split Week 1–5 result data.
- Live Standings zone labels for 12-wrestler leagues are mapped as follows:
  - Global League: rank 1 `Champion`; ranks 2–4 `Elite Cup Qualification`; ranks 5–8 `Mid-table`; ranks 9–11 `Relegation Playoff`; rank 12 `Direct Relegation`.
  - Continental League: rank 1 `Champion + Direct Promotion`; ranks 2–4 `Promotion Playoff`; ranks 5–8 `Mid-table`; ranks 9–11 `Relegation Playoff`; rank 12 `Direct Relegation`.
  - National League: rank 1 `Champion + Direct Promotion`; ranks 2–4 `Promotion Playoff`; ranks 5–8 `Mid-table`; ranks 9–11 `Relegation Playoff`; rank 12 `Direct Relegation`.
  - Regional League: rank 1 `Champion + Direct Promotion`; ranks 2–4 `Promotion Playoff`; ranks 5–12 `Regional League Hold / Safe`.
- Regional League has no lower league. The app must not show direct relegation or relegation playoff status for Regional League ranks 5–12.
- Legacy Table ingestion merges the workbook `Legacy_Tracker` facts with current-master `Standings_Current` league/placement context and `Winning_Streaks` longest-streak values, without inventing missing titles, cups, promotions, relegations, invincible runs, or historical achievements.
- GOAT/Legacy commentary is deterministic and should refresh when workbook/current-master inputs change, including titles, Elite Cup wins, direct-promotion facts when present in source data, relegation/retention facts when present in source data, longest winning streaks, invincible markers, doubles, and material placement checkpoints.
- Commentary priority is presentation-only and fact-backed: Global Championship, Elite Cup, league title/split champion, promotion story, relegation/retention story, all-time/longest streak, current streak, invincible/undefeated marker, rise/fall, then stable league context. Generic streak commentary must not outrank recorded championships or major event wins.

## Phase 10.8.4 — Current League Composition & Legacy Title Count Authority Fix

- Current active league membership is resolved from the current master/app state first, then from post-finals/current split composition evidence. For the active Closing Split, the accepted Closing Split schedule is supporting authority for the current 12-wrestler league composition and is used to correct stale Opening Split roster placement rather than falling back to the old `Roster_Seeds` table.
- Active standings, Live Standings, Result Entry, Simulation, Schedule, Dashboard previews, Week Review, and Legacy current-league context must use one current composition: the current master/post-finals Closing Split league membership. A wrestler promoted or relegated after finals must not remain displayed in the previous split league.
- Closing Split points are split-scoped and calculated from Closing Split scheduled results only, grouped by the wrestler’s current Closing Split league. Opening Split records may remain historical source data but must not drive active Closing Split points or current league placement.
- Composition validation now requires each current league to contain exactly 12 wrestlers, each wrestler to appear in exactly one active league, and each scheduled active-split matchup to match both wrestlers’ standings league. A mismatch must name the wrestler and both leagues, for example: “Current league composition mismatch: Jey Uso is scheduled in Continental League but standings roster places him in National League.”
- Legacy league titles aggregate across every completed split with complete league winner records. The invariant is `completedSplits × 4 = expectedLeagueTitleRecords`; therefore 1 completed split requires 4 league title records, 2 completed splits require 8, 3 require 12, and 4 require 16.
- A split is counted for Legacy league-title purposes only when all four league winner records are available from explicit legacy/history records, completed split final standings/champion records in the current master, or finalized League Finals/Post-Finals history. Partial winner sets are not completed and must report: “Completed split has incomplete league winner records: expected 4, found X.”
- Legacy and GOAT commentary refresh from corrected Legacy stats and current master composition. Current league references must use the current league, while prior league movement may only be referenced as historical context when source data supports it.

## Phase 10.8.5 — Live Standings Active Split Result Source Fix

- Live Standings active points and records are recalculated from active split results only. For League Year 2 Closing Split, the active result window is Year Week 25 through Year Week 46, mapped as Closing Split Week 1 through Closing Split Week 22.
- Closing Split Week 5 specifically allows only Year Weeks 25, 26, 27, 28, and 29 for active standings. Opening Split results, League Finals results, previous-year rows, legacy/career aggregates, and all unfiltered workbook results are excluded from the active table.
- Current league composition / roster authority remains separate from result authority. The current master/post-finals roster and accepted schedule can define membership and fixtures, but accepted schedule snapshots are not points sources.
- Legacy aggregation remains separate from active split standings. Legacy, GOAT commentary, title counts, and historical/career records may continue to use historical aggregation when explicitly labeled as legacy/history data.
- Active split diagnostics now block/flag impossible values: matches played must be less than or equal to the active split week, points must be less than or equal to active split week × 3, wins + draws + losses must equal matches played, and points must equal wins × 3 + draws.
- Active split composition diagnostics require each league to have exactly 12 wrestlers and require no duplicate wrestler across active leagues. An impossible row is reported with a blocking source warning such as: “Active split standings source is invalid: wrestler has 13 matches in split week 5.”

## Phase 10.8.6 — Live Standings Reconstruction From Post-Finals Roster & Locked Results

- Active Live Standings are reconstructed from two layers: the post-finals/current Closing Split roster and then the locked or recorded active split results. The table must not use stale Opening Split seed rosters, previous split league membership, legacy aggregates, or the latest week alone as its current league/points authority.
- The previous split final table / Week 24 / League Finals / Post-Finals transition determines the Closing Split league composition. Promotions, relegations, and retained wrestlers must produce one active roster with exactly 12 wrestlers per league and no duplicate wrestler across leagues.
- Closing Split results already entered on the website or promoted into the current master must be preserved and applied from Year Week 25 through the latest completed/current week. For a Week 5 display, Weeks 1–5 are included when recorded; missing weeks produce diagnostics instead of fabricated standings rows.
- Result identity reconciliation is allowed when a stable match id changed between the accepted schedule, workbook writeback, close package, and browser-local state. Exact match id is preferred; otherwise league + year week + split week + participants may reconcile the result, with a diagnostic noting the mismatch.
- Master/app results are preferred over browser-local overlays for the same scheduled match. Browser-local overlays are only used for locked/recorded matches not already represented by the promoted current master, so the same match is never double-counted.
- Legacy remains historical aggregation. League title counts, GOAT/Legacy comments, and winning-streak history must not be reduced to active split data or recalculated only from Live Standings.
- Diagnostics should identify source problems directly, including missing post-finals transition evidence, duplicate active wrestlers, roster/schedule league mismatches, too few locked Closing Split weeks for the visible week, missing week result sets, and reconciled result id mismatches.

## Phase 10.9 — Dashboard Predictions, User League Live Table, and Social Feed

- The Dashboard no longer places the Control Room Monitor / Alerts & Review panel in the primary Dashboard grid. The underlying validation and diagnostic data remains available to other workflow/review surfaces and is not removed globally.
- The former right-side Dashboard space now shows a compact current user league live table built from the same active split reconstruction source used by Live Standings. It displays rank, wrestler, played, wins, draws, losses, points, and position status for the current user-controlled league only.
- Dashboard match predictions are deterministic model estimates, not guaranteed outcomes. The model starts from a 50/50 baseline and shifts only with available current split table position, points per match, win rate, recent form, and direct head-to-head evidence. Missing data produces neutral fallback warnings and keeps the matchup close to even.
- Prediction percentages are capped between 15% and 85% and always sum to 100. Dashboard wording uses sports presentation terms such as “Prediction,” “Win Chance,” “Form,” and “Confidence”; it intentionally avoids betting, odds, stake, payout, or gambling language.
- The League Social Feed generates deterministic, non-random comments from current standings, confirmed results, and real upcoming scheduled matches. Event triggers include unbeaten leaders, close top-of-table races, pressure-zone positions, latest confirmed wins, and upcoming user-league match hype.
- Social comments can reference all four leagues when supported by current data. Fallback comments are limited to real scheduled match hype or actual table context and are used only when stronger events are limited.
- Phase 10.9 does not change league rules, source results, standings calculation rules, schedule logic, result entry, simulation, workbook writeback, promotion/relegation, or tiebreakers.

## Phase 10.9.1 — Dashboard Prediction UI and Social Comment Variety Polish

- Dashboard prediction reasons, evidence tags, raw factors, and explanation strings remain internal domain outputs for tests and generation support, but the main Dashboard match card presents only wrestler names, a Win Chance percentage bar, percentages, and a compact confidence label.
- The prediction UI intentionally avoids betting terminology and does not expose detailed calculation diagnostics in the primary card.
- The League Social Feed now uses a deterministic modular template system with separate event pools, fictional league-account personas, opening phrases, middle structures, and endings. The same standings, results, schedule, league year/split/week context, league, event type, wrestler names, ranking context, and matchup anchors produce the same comments without reload randomness.
- Visible social comments are selected with uniqueness rules that avoid duplicate exact text, repeated opening phrases, over-repeated event types, and over-concentration on the same wrestler or league when stronger mixed events are available.
- Fallback social comments are limited to actual upcoming matchups, actual table positions, or real league-wide table context when stronger events are limited; they do not invent wins, achievements, rivalries, injuries, personal drama, or title outcomes.
- The Current User-Controlled Show and Current User League Live Table use an equal-height two-column Dashboard layout with internal scrolling for long card/table content, so panel headers and bottom edges align while the social feed remains below both panels.
