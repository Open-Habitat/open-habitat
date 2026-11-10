# Result — 10 November 2026

Fixed both observations, starting from `bb5241c0f` on Birch.

## Cause and change

The title failure was a spec defect: an enabled composer is not proof that Pi
owns tab-kept input. The spec now waits for the opened view and native status
`run_active && native_history === "present"` before navigating away. Its held
turn is still released only after navigation. No keyboard/tooltip oracle changed.

The absent Ei nyt was a product defect. Instrumented `railNow` in a disposable
browser run showed the cached status at journal position 13 with
`run_active: true`, **fresh: false**, while the settled snapshot had
`run_active: false` and `last_reply`. Attention was `new`. The rail ignored
staleness for runActive (although it already checked it for command), so this
known-obsolete status suppressed the action. This persisted through the failed
five-second assertion, not just a Tab press before an action appeared.

`railNow` now uses the snapshot's run-active fact while the status is stale.
Fresh statuses still take precedence, including a newly started turn. No status
merge, session lifecycle, transport, contract or daemon code changes. Temporary
console instrumentation was removed.

Two Vitest cases step the actual ConversationStore's status/event/snapshot
inputs with the replacement status read held: settled status before the event,
and event before settled status. Ei nyt must be present once the settled
snapshot arrives, stay present after the read, and disappear for a fresh active
status. Restoring the old expression makes the event-first case fail (17 pass,
1 fail); the fix passes all 18 rail tests.

## Evidence

All browser runs used synthetic hosts, umask 077, disk-backed TMPDIR, two
workers, port base 16400 and timeout bounds. Commands from `web/`:

`npx playwright test tests/rail-archive.spec.ts --repeat-each 6`

- Original spec/product, D250 seed `sweep-tooltip`: 8 pass, 4 title failures.
- Handover correction only: 10 pass, 2 missing Ei nyt failures.
- Instrumented unchanged rail expression: 10 pass, 2 missing Ei nyt failures;
  trace console captured the stale-status/settled-snapshot facts above.
- Fixed product/spec: D250 `sweep-tooltip`, D250 `residuals-second`, and default
  delay D60 `residuals-default`: **12/12 each**. Default delay was supplied
  explicitly for direct Playwright repetitions (the focused shell runner has
  no repeat-each passthrough).
- `./scripts/test-focused.sh --area web`: static/unit/component checks pass,
  206 files, 1548 tests.
- `./scripts/test-focused.sh --area browser --spec rail-archive.spec.ts` with
  no delay override: 2/2 pass. Final focused Vitest rerun: 18/18 pass.
- `issuectl doctor --json`, project-view validator and `git diff --check` pass.

Disposable logs: `/var/tmp/residuals-archive-{before,ready2,probe,fixed,second,default}.log`,
`/var/tmp/residuals-{web,unit,unit-before}.log`. Trace files are disposable and
were overwritten by later runs; the diagnostic facts are retained above.
No live-server, cross-UID, full-suite or clean-gate claim.

## Review and decisions for later review

Focused self-review: checked both input orders, stale versus fresh status,
new-turn suppression, and the unchanged keyboard/tooltip/archive oracles.
This is a small UI projection fix, not a session/daemon/authority change;
independent LLM review was not required or run. No new product choice.
