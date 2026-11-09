# Result — 9 November 2026

An interrupted recap is recovered from native history by the existing startup
pass. If recovery cannot start Pi, the conversation now shows the existing
`not_written` recap failure card instead of silently losing the waiting card.
A later restart derives the obligation again and can produce the recap.

No durable state, new scheduler or read-triggered start was added. Pre-launch
refusals are bounded transient outcomes for the startup batch; failures after a
handle exists use its existing recapFailure. Successful ownership acquisition
retires the pre-launch outcome. Native `through` still controls whether the
browser shows the failure or the completed recap.

## Evidence

- Reproduction first: `TestRecapInterruptedByRestartReportsUnwrittenWhenRecoveryCannotStart`
  started generation, interrupted it, created a fresh controller from the same
  synthetic history and forced recovery's capacity refusal. Before the fix,
  status was 200 with no recap_failure; the test failed. Afterward it reports
  not_written through a1. It also rejects inventing a failure for a manually
  stopped handle without a recovery attempt and checks the old-handle refusal.
- `go test -race ./internal/daemon -run Recap -count=1`: passed, including pinned
  native Pi tests and the regression.
- `OH_PORT_BASE=17400 ./scripts/test-focused.sh --area browser --spec recap-resting.spec.ts`:
  all four passed. Actual fake-model generation is held until daemon restart;
  success produces the automatic card, capacity refusal produces a visible
  failure, and a second restart with room produces the recap and removes the
  failure. Existing persisted-recap and idle-stop cases remain covered.
- `./scripts/test-web-fast.sh`: passed.
- `./scripts/test-focused.sh --area contracts`: passed, 97 schemas and 155 fixtures.
- `go test ./internal/daemon/...`: integrations passed; daemon had six existing
  failures: two Unix socket path-length cases, three editor lifecycle tests and
  TestSnapshotDiscoveryAndSchema rejecting synthetic scratch under the real
  home. All six were reproduced on main at 5ffa5e03b with the same environment.
  Initial missing Python referencing was fixed with a private requirements-ci
  venv before this final run. No full-package success is claimed.

Logs: `/home/maintainer/.local/state/rr/` (`race.log`, `browser-final.log`,
`web-fast-final.log`, `contracts.log`, `go-final.log`, `baseline.log`). Synthetic
same-UID tests are not an installed-host upgrade or isolation qualification.
The original test-server refusal was not identified from its journal; capacity
is the demonstrated reproducer, not an asserted cause of that exact incident.

## Review

Used /llm-review + /assess-findings because daemon lifecycle/concurrency changed:
Claude Fable 5.1 finder and GPT-6 Astra verifier. Three confirmed problems in the
initial read-side fallback (false failure for unattempted work, false failure
while waiting, repeated full native scans) were fixed by recording actual
recovery refusals instead. Final local review checked mutex/handle fences,
no-failure cancellation/takeover paths, map retirement and browser native
currentness filtering. No residual findings or new issues.

Review/assessment scratch is in `history/review-recap-restart.md` and
`history/assessment-recap-restart.{json,md}`; this result preserves the conclusions.
