# Result

The administrator storage path now collects broker quota pages (15 rows each)
with at most eight account verifications in flight. The broker retains its
exclusive ledger lock, committed UID selection, account verification and final
same-state fence. No usage store or identity authority moved.

A drifted account or unreadable quota is an unavailable row with zeroed values,
not an all-list failure. Filesystem capacity remains visible; overcommit is
explicitly unknown (`null`) for a partial list. CLI and browser preserve this
state. The root control operation now shares its socket's absolute five-second
deadline, preventing expired page collectors from continuing behind the CLI.

## Evidence

Base: `0b62c22b`. The implementation is the commit carrying this result and
`Fixes-Issue: admin-storage-list-timeout`.

- `TMPDIR=/var/tmp`, `umask 077`, `go test -race -count=1 ./internal/provision ./internal/gateway ./internal/cli ./internal/contracts ./test/browser-host`: passed.
- `go test -race -count=1 -v ./internal/provision -run '^TestQuotaPages50WithinControlDeadline$'`: **0.778 seconds** for all 50 committed accounts, with 100 ms verification latency, one drifted unit and one native quota failure, under a five-second context. The test also checks UID selection and absence of values on unavailable rows.
- `./scripts/test-web-fast.sh`: passed; 488 unit/component tests, formatting, lint and TypeScript.
- `cd web && npx playwright test tests/settings-name-and-storage.spec.ts`: two passed on the routed synthetic browser runner, 3.4 seconds test time. Desktop/phone storage layout and limit editing remain working. The new partial-list display is covered at the component/parser layer.
- `./scripts/check-generated.sh`, `python3 scripts/validate-contracts.py`: passed after updating the partial-row schema/example and regenerating fingerprints.
- `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

Initial test failures were repaired and rerun: a missing Go import; a mistaken
role-write expectation introduced while updating fixtures; and an existing
checkout integration test run with the wrong umask (both main and worker pass
with 077). Discovery commands also encountered absent guessed paths; actual
scoped files replaced them. Dependency installation emitted existing audit
and peer warnings; no dependency updates were made.

## Review and limits

Security-focused independent review: Claude Fable finder and GPT Astra verifier.
The finder identified the expired root collector issue, fixed in this diff.
The verifier confirmed the deadline fix and found no remaining reachable
security defect. A proposed large-response overflow was refuted by the existing
4096-byte committed-ledger bound (not by a guessed account count). An already
admitted broker page can finish within its independent two-second budget after
client cancellation; the collector issues no further pages.

This is controlled synthetic timing, not a live systemd benchmark or new
separate-UID isolation proof. Existing per-page broker deadlines and native
verification still apply; a stalled broker or corrupt ledger fails the request.
The existing small ledger-file bound remains unchanged; this does not claim
that the installation can publish all 4096 reserved UIDs. No full gate or test
server deployment was run by this worker, so no live KOKEILTAVAA entry is claimed.

Optional model-performance corpus logging was attempted once and failed with
SSH authentication refusal to alder (helper exit 3 / SSH255). The two independent
review calls themselves succeeded; local review and assessment artifacts remain
under `history/` and `/var/tmp/quota-*`. No product check depends on corpus logging.
