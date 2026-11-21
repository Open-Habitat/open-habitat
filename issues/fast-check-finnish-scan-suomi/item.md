---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed by a worker running the focused web check
source_ref: taskfleet:01m7zbxs4sc2a2kmjkfb4dpxeh/observed:finnish-scan-language-settings
originating_run: 01m7zbxs4sc2a2kmjkfb4dpxeh
originating_run_kind: spinoff
lane: gate-red
lane_seq: 1
preparation: ready
closed: 2026-11-21
---

# Fast web check fails: finnishScan flags the language menu's own name Suomi

## Description

`web/src/i18n/finnishScan.test.ts` ("finds no Finnish outside the catalogs")
fails on `main` at 3f8ab4e8: it reports `components/LanguageSettings.tsx`
line 15, text `Suomi`, which the language menu shows as the language's own
name. Reproduce: `npx vitest run src/i18n/finnishScan.test.ts` in `web/`.
The fast web check (`scripts/test-focused.sh --area web`) is therefore red
for every worker. Either the language's own name belongs in the scan's
allowance (it is the same in every interface language by design) or it moves
into a catalog.
