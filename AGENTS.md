# Project Instructions

This project is a WWE 2K26 League Tracker.

Rules:
- The Excel master file in /source-docs is the source of truth for current standings, results, schedules and roster state.
- The rulebook and transfer package in /source-docs are the source of truth for rules.
- Do not invent rules silently.
- If data conflicts, document the conflict in docs/assumptions-and-conflicts.md.
- The website must never guess matchups. It must always read matchups from the schedule/matchup reference.
- Add validation for duplicate wrestlers, invalid matches, wrong points, missing results and impossible records.
- Keep logic separate from UI.
- Use TypeScript.
- Add tests for all rule calculations.
