# WWE 2K26 League Tracker

A workbook-driven Next.js tracker for the active League Year 2 format.

## Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

### Local one-click Git finalization

To enable the post-promotion validation, commit, push, and next-week reload flow
in PowerShell, start the development server with:

```powershell
$env:ALLOW_LOCAL_GIT_AUTOMATION="true"; npm run dev
```

This capability is local-only and must not be enabled in production. When the
environment variable is absent, workbook promotion remains available but Git
finalization is safely disabled.

## Source data

The app first looks for `source-docs/current-master.xlsx`. In this repository it falls back to the single role-labelled workbook whose filename contains `source-docs-current-master`.

The current implementation reads the workbook only. The Result Entry page validates decisive results against scheduled National League match IDs but does not write to the workbook.

## Simulation preview

The `/simulation` page reads the user-controlled league from workbook metadata, excludes it, and offers weighted previews only for open matchups that agree between the schedule and `Matchup_Reference`. Generated results can be edited and confirmed into the shared browser-local tracker state.

The `/week-review` page reviews all 24 matches, blocks incomplete weeks, locks completed weeks, calculates app-state standings over the workbook baseline, and supports JSON backup/restore. None of these actions modify the Excel workbook or server data.

## Trust boundary

Workbook ingestion is limited to the repository-controlled current master file. Do not point the importer at untrusted uploads; the SheetJS community package currently reports upstream security advisories with no published patched npm release.
