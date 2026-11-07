# Result

The issue's `conversation_pi_ended` immediately followed by `close` points to
the empty-conversation branch of the same archive UI, not normal archive.
`stopIfIdle` already calls `stopIdleLocked(..., "person")`. But `closeEmpty`
called `rpc.close()` without `stopFor`, allowing the exit watcher to assign
`crash` and log `outcome=unasked`. The issue calls that field `reason`; the
actual diagnostic uses outcome.

`closeEmpty` now records person intent under the controller mutex after its
pre-shutdown refusal checks and before touching Pi. The watcher's first-cause
rule then preserves it. Post-shutdown history/ownership checks can still refuse
deleting the empty conversation; the requested stop remains a person stop.

## Evidence

- `TestCloseEmptyBrowserChild`: HTTP close of empty/absent native history records
  person and the native person-stop marker; all pre-shutdown refusal cases leave
  the live child and its stop reason untouched. The test runs a real synthetic
  child and the actual exit watcher, not a provider.
- `TestArchiveStopsIdlePiButNotBackgroundWork`: normal archive's stop remains
  person and live background work remains running.
- Full `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  passed after installing requirements-ci.txt in a disposable uv venv.
- Focused `go test -race ./internal/daemon -run
  'TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters|TestCloseEmptyBrowserChild|TestArchiveStopsIdlePiButNotBackgroundWork' -count=1` passed.
- Independent llm-review / assess-findings with claude-fable-5-1 and gpt-6-astra
  checked stop ordering and the companion's person marker; no remaining daemon
  finding. Review performance logging disabled to respect this no-push session.

The journal excerpt and source identify a reproducible explanation, not a
recovered full trace of that particular Pi's process exit. No live test server
was changed or tested, and no full clean gate was run.

## Decisions for later review

- Use the existing `person` cause for closing an empty conversation, as archive
  and explicit stop already do. Alternative: a new close/archive-specific cause.
  No new product rest category or contract is needed to distinguish an asked
  stop from an unexpected end.
