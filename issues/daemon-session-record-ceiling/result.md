# Result

Stopped records no longer impose a lifetime conversation limit. All new-record paths reclaim the oldest eligible reaped tombstone under the controller lock. Recent records/receipts remain until pressure needs their space. Live children, pending starts, held messages/bash, active naming/recapping/waking and pending automatic-wake candidates remain protected. Native histories and browser ownership markers are not removed.

True record exhaustion returns `429 session_records_exhausted`, distinct from `capacity_exceeded`. Continuation parses it as a definite refusal; create does not show the live-limit card. A continuation already proving an evicted handle can restore its facts only into an empty slot, under the native ownership proof, origin check and record bound; a competing replacement still blocks it.

## Evidence

Tested working tree based on fb0c118b4; exact source is in this issue's fixing commit.

- `go test -race ./internal/daemon -run TestConversationRecords -count=1`: passed. Includes 130 synthetic Pi create/stop cycles followed by a successful create, oldest-eligible selection, recent receipt retention, held/live/start/wake protection, distinct exhaustion, and continuation of an evicted captured handle with native history.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed after installing the documented Python requirements in a disposable uv venv. Initial run failed because `referencing` was absent, not because of a source defect.
- `./scripts/test-focused.sh --area web`: 175 files / 1320 tests passed, plus static checks.
- `./scripts/test-focused.sh --area browser --spec mutation-layer.spec.ts`: 5 passed, with OH_PORT_BASE=13700 and OH_BROWSER_WORKERS=2. The refusal case now exercises record exhaustion, explicitly excluding the live-limit card. Actual capacity-card coverage remains in live-conversation-limit.spec.ts.
- Independent `/llm-review`: claude-fable-5-1 finder, gpt-6-astra verifier; `/assess-findings`: two confirmed fixes, both implemented (pending auto-wake eviction and captured-pointer continuation race). Local scratch: history/review-session-records.md and history/assessment-session-records.{json,md}. No follow-up issues. Model assessment logged through the canonical Alder writer.

Synthetic tests establish daemon/browser state behavior, not provider use, separate-UID isolation or live deployment. No full browser suite or clean gate was run; those belong to integrated main.

## Decisions for later review

- Keep the 128-record memory bound and evict only as needed, oldest stopped time first (ID breaks ties). A TTL or unbounded table would either discard recent lookup unnecessarily or remove the memory bound.
- Pending automatic-wake checks within the existing 24-hour horizon count as retained work, not disposable tombstones. If every record carries work, refuse with the new code instead of dropping someone's unsent message or scheduled wake.
- Evicted old memory-only receipts and stop-detail facts are forgotten, as on daemon restart; native history survives. No secondary rest-fact cache is added: it would only move the same bounded-eviction problem to another table. A continuation already holding the old pointer preserves its facts under the existing native proof.
- Record exhaustion uses the existing generic refusal presentation, not new wording or a new card. It must never suggest that changing the live-conversation limit will reclaim protected records.
