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
- **Active League Year 2 order:** (1) points, (2) head-to-head, (3) longest winning streak, and (4) a tiebreaker match only if the wrestlers remain tied.
- **Resolution:** implement this order for League Year 2 standings and tiebreak qualification. Seed is not an automatic tiebreak criterion.
- **Remaining boundary:** the exact calculation of head-to-head for a tie involving three or more wrestlers is not specified. The application may identify the tied group and available head-to-head evidence, but must not invent a mini-table formula. If the first three active criteria still do not resolve a consequential tie, use a tiebreaker match; the exact multi-person match format remains case-specific unless documented.
- **Status:** **resolved for the ordered criteria; multi-wrestler head-to-head calculation and match format remain open**.

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
- **Current handling:** the Phase 1 model supports explicit outcome states, but the import maps only the decisive winner/loser rows demonstrated by the workbook. The Result Entry page permits schedule-locked decisive-result validation only and performs no workbook write. Draw, DQ, no-contest, and unclear-result entry remain disabled until their workbook encoding is documented.
- **Status:** **open data-encoding question; Phase 1 safely constrained**.

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
