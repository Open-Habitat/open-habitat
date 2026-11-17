---
created: 2026-11-17
updated: 2026-11-17
type: bug
status: untriaged
priority: low
provenance: other
provenance_detail: worker observation in lab stress
source_ref: taskfleet:01m7m7v8w7g8jr9j7pqrdsnnze/observation:first-turn-ends-before-running-status
originating_run: 01m7m7v8w7g8jr9j7pqrdsnnze
originating_run_kind: spinoff
---

# Activity line never shown when a first turn ends before its first running status (heavy-load lab)

## Description

Observed while fixing `first-message-shift-phone-gate` (taskfleet run 01m7m7v8w7g8jr9j7pqrdsnnze).

`web/tests/lab-first-message-flicker.spec.ts` "first message layout 390 creating" fails about 1 run in 30–60 under `OH_CPU_THROTTLE=6 OH_REPLY_DELAY_MS=250`, at the assertion that the turn's activity line is shown at all (`shown >= 0`). Not seen at 4× in 80 runs, and not seen in the gate.

What happens: the synthetic Pi turn finishes and its history (user message plus final reply) is read before the first status saying the run is active arrives. The turn is therefore drawn finished from the start. The next status sets `run_active: true` for one read, so the composer shows Stop next to a finished reply with no "Näytä työ · Agentti työskentelee" row. The status after that ends the run.

The turn-end hold (`timelineItems` `wasRunning`) deliberately never revives a turn that was not drawn running. Options: accept this as correct (status lags a turn that has already ended) and make the spec's "shown" expectation conditional on a running frame existing before the saved final reply; or treat the newest turn after the person's own just-sent message as running while the status says so. The second option touches the authority rule `turn-end-jitter` chose.

Reproduce: `OH_CPU_THROTTLE=6 OH_REPLY_DELAY_MS=250 OH_BROWSER_WORKERS=4 npx playwright test --config playwright.lab.config.ts tests/lab-first-message-flicker.spec.ts --grep "390 creating" --repeat-each 30` from `web/`.
