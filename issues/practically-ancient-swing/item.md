---
created: 2026-11-17
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed while verifying a run
source_ref: taskfleet:01m7mwjysd6phg3fjg5eyqz122/observed:live-row-spacing-flake
originating_run: 01m7mwjysd6phg3fjg5eyqz122
originating_run_kind: spinoff
lane: test-stability
lane_seq: 1
preparation: ready
closed: 2026-11-21
---

# Lab spec 'live row stays at its spacing' fails depending on machine conditions

## Description

`web/tests/lab-conversation-scroll.spec.ts` › `@lab the live row stays at its spacing above the composer` fails depending on machine conditions. On an unchanged `main` checkout it passed 7 of 7 serial runs at one time and failed 6 of 6 later (`--workers 1 --repeat-each 3`, `OH_REPLY_DELAY_MS=60`). It reports a stretch of roughly 8.4–9.2 s with 140–330 px more than the design spacing under the last row while the turns "pitkä ajo" and "kolmas viesti" run.

The case measures frames against fixed `waitForTimeout` waits (1000 ms, 2500 ms) and the slow-history fixture, so either the following logic really leaves a gap while a slow history read settles a turn, or the spec's wall-clock waits race the fixture under load. Either way it cannot serve as a green/red signal as it stands. Reproduce: `npx playwright test --config playwright.lab.config.ts tests/lab-conversation-scroll.spec.ts --grep "live row stays" --repeat-each 3 --workers 1`.

## Comments

### 2026-11-21T10:28:33Z · @agent

Reproduced by taskfleet run 01m7ys3tjr9mtc4d294wvv7fv6 (spinoff) on unchanged main b4813239b9b32196e6a7e1ed8f64d6492f1f89d7: focused lab-conversation-scroll.spec.ts with tag "live row stays", OH_BROWSER_WORKERS=2 and default 60 ms focused reply jitter failed at line 301 with "9203ms +328px". The hygiene branch failed the same assertion with "8399ms +142px" after two full passing repetitions. Neither the spec nor scrolling code was changed. Logs: /var/tmp/agent-keep/five-hygiene/history-main.log and browser-final.log. The main revision was unchanged before and after the baseline run. This existing report remains unlaned; no duplicate was filed.

## Resolution

### 2026-11-21T14:57:36Z · @issuectl

Spec waited on the wrong signal and lost its second turn; fixed in the spec helpers. See result.md.
