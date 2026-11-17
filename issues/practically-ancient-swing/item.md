---
created: 2026-11-17
updated: 2026-11-17
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying a run
source_ref: taskfleet:01m7mwjysd6phg3fjg5eyqz122/observed:live-row-spacing-flake
originating_run: 01m7mwjysd6phg3fjg5eyqz122
originating_run_kind: spinoff
---

# Lab spec 'live row stays at its spacing' fails depending on machine conditions

## Description

`web/tests/lab-conversation-scroll.spec.ts` › `@lab the live row stays at its spacing above the composer` fails depending on machine conditions. On an unchanged `main` checkout it passed 7 of 7 serial runs at one time and failed 6 of 6 later (`--workers 1 --repeat-each 3`, `OH_REPLY_DELAY_MS=60`). It reports a stretch of roughly 8.4–9.2 s with 140–330 px more than the design spacing under the last row while the turns "pitkä ajo" and "kolmas viesti" run.

The case measures frames against fixed `waitForTimeout` waits (1000 ms, 2500 ms) and the slow-history fixture, so either the following logic really leaves a gap while a slow history read settles a turn, or the spec's wall-clock waits race the fixture under load. Either way it cannot serve as a green/red signal as it stands. Reproduce: `npx playwright test --config playwright.lab.config.ts tests/lab-conversation-scroll.spec.ts --grep "live row stays" --repeat-each 3 --workers 1`.
