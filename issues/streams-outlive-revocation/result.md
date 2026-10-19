# Result

Implemented in the commit carrying `Fixes-Issue: @streams-outlive-revocation`.

- A per-session registry binds each streaming relay to a cancellable context. Registration rechecks authority under the same mutex as removal, so a request authenticated before revocation cannot register afterwards.
- Session publication cancels removed sessions synchronously, including logout, subject revocation and session-store invalidation. Expiry is checked once a second against the current idle and absolute deadlines; ordinary authenticated requests can still renew idle expiry. Relay traffic does not renew it.
- The HTTP transport closes the daemon connection on cancellation; finished requests release their registry entries. Future hijacked/WebSocket relays can use the same context, but must explicitly close their hijacked sockets on cancellation. No shell or WebSocket endpoint is introduced here.
- The existing browser journal's error probe already recognizes 401 and returns to sign-in. No browser production-code change was necessary.

## Evidence

Synthetic only, Linux, `umask 077`, disk-backed `TMPDIR=/var/tmp/oh-KaU5`:

- Baseline: exported pre-change HEAD plus the new network-stream regression test. All five cases failed with `stream survived session ending` after three seconds: logout, administrator revocation, idle expiry, absolute expiry and invalid session store.
- Final `go test -race -count=1 ./internal/gateway ./internal/transport ./internal/core ./internal/cli ./test/browser-host`: passed. Stream tests open a real TLS gateway → Unix socket daemon stream, assert browser EOF and upstream context cancellation. Registration-race, session isolation and release checks pass.
- `./scripts/test-focused.sh --area contracts`: passed; no contract changed.
- `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `./scripts/test-web-fast.sh`: passed (format, lint, typecheck, unit/component tests).
- `OH_PORT_BASE=17400 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag '@stream-revocation|logout fences'`: two passed. The new case signs out through another tab while a real EventSource is open, observes sign-in on the original tab and runs Axe there. Existing failed-logout fencing also passes.

## Decisions for later review

- Chose a one-second live-request expiry check rather than a fixed request deadline: renewed idle deadlines remain authoritative, and expiry does not depend on another browser request or a daemon heartbeat. One ticker exists per active relay and stops with its context.
- Only relays marked streaming are registered; existing finite-request deadlines remain unchanged. The future upgrade implementation must opt into the registry and close its own socket.

## Limits and failed attempts

No live host, distinct-UID, provider or future WebSocket verification; no deployment or push. Full clean gate intentionally not run in this worker. Initial new Go tests used a plain HTTP test server and failed with 400 (the production exact-request guard correctly requires TLS); changed the synthetic server to TLS. Initial formatter invocation from the repository root rejected nested Biome configuration; formatting from `web/` and rerunning the fast checks passed. Baseline regression failures are intentional evidence, not final failures.

## Independent review and assessment

Final-diff `/llm-review --rigor critical --no-perf-log`: finder `claude-fable-5-1`, focused high-risk false-negative verifier `gpt-6-astra`, two successful calls, no confirmed defects or actionable candidates. Local checks independently verified registry publication, authenticate/register locking and upstream cancellation. `/assess-findings` recorded an empty decision table (all outcome counts zero); no follow-up issues warranted. Scratch reports: `history/review-gateway-security.md` and `history/assessment-gateway-security.{json,md}`.

Timing limit: expiry checks occur once a second; cancellation cannot retract buffered bytes, and a downstream write already in progress has the existing ten-second deadline. This is prompt termination, not zero bytes after the exact instant of revocation.

Tested source: base `0f5171328f4fee8f84ba5a5f9a16f90ac0728df8` plus final reviewed diff SHA-256 `7b281aee408423789faee21ad31bf42cb9ff947a2828df4ef01024447f2b6e3b`. Documentation/issue-only edits afterwards were checked with `validate-project-view.py`, `issuectl doctor --json` and `git diff --check`.

Tooling note: the installed issue skill pin was stale; loaded the current binary's bundled skill read-only instead. One unsupported skill-print positional invocation was corrected using its help. No required check remains failed or incomplete. Remote model-performance logging was explicitly disabled to avoid a corpus push during this no-push worker.
