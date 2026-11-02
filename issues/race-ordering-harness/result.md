# Result

Implemented on base `7b609ac0f763d99ab07c6da209d9472593943ce5` (Birch).
No production state code or existing browser assertions changed.

- Opt-in `OH_REPLY_DELAY_MS`, seeded per method/path with `OH_REPLY_SEED`.
  Independent cancellable waits, synchronized counters, no shared unsafe RNG.
  Fixture failure output prints the seed; stress exports one seed to all hosts.
- Marked default-on switch in `browser-focused.py`, currently 0 (future 60).
- Stepped Vitest transport with reply/event delivery and undelivered checks;
  example enumerates page-before-disposal and disposal-before-page.
- CPU/timeout configuration plus `scripts/browser-stress.sh`, sequential ordinary
  and lab suites under one suite lock, distinct ports, two repeats. Not in gate.
- Client ordering rule and spec readiness/timer/fixture rule documented.

## Counts and validation

The sweep assigns no failing cases to this prevention issue: before/after
product-case counts are **not applicable**, not 79 fixed. Groups 1–9 belong
to their product/spec workers. No full browser suite or stress run was run.

| Detector / check | Before / negative control | After |
| --- | --- | --- |
| Stepped identity disposal, both orders | bypass disposal: 2/2 failures, 4 ms | 0/2 failures, <5 ms test body |
| Stress smoke ordinary account-settings :490 | not measured | 0/2 failures |
| Stress smoke lab-conversation :26 | not measured | 0/2 failures |

Smoke command: `OH_PORT_BASE=11000 OH_BROWSER_WORKERS=2 OH_REPLY_SEED=harness-smoke bash scripts/browser-stress.sh 'unavailable snapshot does not display previous identity|browser Pi resolves'`.
Both suites used CPU 4×, jitter 250 ms, timeout scale 4, repeat-each 2;
ordinary 6.8 s, lab 7.0 s (excluding builds). Synthetic host-backed evidence,
not live-host or distinct-UID evidence. Log (disposable):
`/var/tmp/oh-harness-smoke.UrI9Ya/stress.log`.

Also passed:
- `./scripts/test-focused.sh --area web`: 167 files, 1233 tests, static checks.
- `go test ./test/browser-host` and `go test -race ./test/browser-host`.
- Focused browser entrypoint, account-settings :490 selected by tag, with
  jitter 250 ms, seed harness-focused, timeout scale 4: 1/1 passed.
- `python3 scripts/validate-project-view.py`, `git diff --check`.

Review: focused self-review plus targeted `/llm-review` of host wiring,
claude-fable-5-1 finder and gpt-6-astra concurrency verifier: no findings.
Local cancellation/bypass/schedule tests and race detector support that result.
Report: `history/review-race-ordering-harness.md` (local scratch).

## Decisions for later review

- Keep the sweep's pre-dispatch delay, not a buffered response writer. Buffering
  would change streaming/flushing semantics. SSE remains ordered and undelayed;
  exact event/reply permutations are explicit in Vitest. A seed reproduces the
  per-route delay schedule, **not** OS scheduling or an entire race exactly.
- Sequential stress suites instead of simultaneous: lower incidental saturation,
  still both under one lock. CPU throttle affects fixture/context.newPage pages,
  not popups. Explicit spec timeouts remain explicit, as in the sweep.
- Example exercises existing identity disposal, not another worker's in-flight
  status merge fix. It extends the existing single late-page regression to both
  orders and demonstrates the shared helper without editing their files.

## Development failures / limits

An initial candidate example assumed `confirmMissing` invalidated a pending
successful page; one order failed. That is not the disposal contract and was
not used as a purported product regression. Replaced with the established
identity-disposal invariant. Deliberately bypassing disposal then failed both
orders; restored source passed. No product change was made from that experiment.
A `.test.ts` lookup missed the existing `.test.tsx`; corrected. One edit had a
nonunique match and was retried with context. Focused runner rejects
`--go-package ./test/browser-host` (only internal packages accepted), so direct
Go tests were used. Its `--help` also returned usage exit 2. These did not block
validation. No assertion was weakened and no tool failure was hidden.
