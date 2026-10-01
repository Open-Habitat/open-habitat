# Result

Implemented at `6b354487786854db64b0707a497fc597380eff6e`. Gateway snapshot, Pi status/attempt, history/content, conversation and events requests now use one Unix-socket HTTP transport. The gateway builds its own request, routes only to the session's mapped socket, forwards status/Content-Type/body without decoding daemon replies, caps finite responses at 2 MiB, flushes SSE as bytes arrive, bounds each browser write to 10 s and each stream read idle period to 60 s. The existing conversation lease remains: create records the returned handle and list filters to owned handles. Origin and CSRF still guard writes.

The browser's obsolete 502 branch and synthetic fixture that asserted gateway snapshot identity rebinding were removed. The real daemon still checks its configured identity and peer before accessing native files; the browser validates snapshot, Pi-status and conversation shapes. Per-browser conversation ownership remains pending `@drop-conversation-lease`.

## Verification

- `TMPDIR=/var/tmp go test ./internal/gateway -count=1` passed during editing. New Unix-socket integration tests cover status/body/header forwarding, extra fields, response size versus unbounded streaming, stream cancellation, and body-less control/attempt framing. Browser-session lease and two mapped synthetic listeners remain covered.
- `TMPDIR=/var/tmp/nah-single-proxy-build NAH_PORT_BASE=14200 PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:e2e --prefix web -- --grep '@pi-attempt|@pi-onboarding|@first-use|@browser-conversation ended|@workspace-slice confirmed|@resilience failed'`: 19 passed.
- `TMPDIR=/var/tmp/nah-single-proxy-build NAH_PORT_BASE=14200 ./scripts/ci-local.sh --clean --json` on committed revision `6b35448`: passed (`clean: true`), including 110 browser cases; log `/var/tmp/nah-single-proxy-gate-final.log`.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed.
- Independent critical security/correctness review (`claude-fable-5-1`, then `gpt-6-astra`) found and confirmed the empty-POST chunking defect; it was fixed before the passing gate. Review and assessment are in ignored `history/review-single-proxy.md` and `history/assessment-single-proxy.{json,md}`.

The first clean gate failed 26 browser cases due to body-less POST framing and the now-obsolete synthetic foreign-snapshot expectation. The first focused browser rerun exposed synthetic Pi-device attempt state leaking between cases (17/19 passed); the fixture was isolated, then 19/19 passed and the clean gate passed. No live host or distinct-UID VM routing proof was run here; same-UID browser-host checks do not establish kernel-user isolation. The optional model-performance corpus write failed because alder's SSH-to-self denied authentication; review and gate evidence are complete without that log.
