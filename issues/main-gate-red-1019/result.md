# Gate repair

## Causes and changes

- **Expiry / resilience:** `4b7da90a` (streams-outlive-revocation) deliberately binds live relays to browser-session lifetime. `/fixture/expire` crosses the idle deadline; the relay closes, the browser probes `/api/v1/events`, observes 401 and clears the previous identity. The old test briefly asserted no login and then waited forever for a reconnect button which had disappeared. Reproduced at `c34f4716`: 30-second click timeout, other two focused browser cases passed. Updated the test to require automatic login while snapshot reads still return 500, after explicitly observing the established EventSource. No session/product code changed, so no security-behaviour review was required.
- **Clone receiving phase:** a test timing race, not a 19 October product regression. History inspection found no 19 October changes to the clone path. `ab4ba595` introduced this test and its synthetic Git's 200 ms receiving window; `ff03c9ba` (17 October) moved cloning to asynchronous jobs and a later subscription, retaining the same short window. A correctly completed clone can leave the screen before Playwright samples the receive text. The existing fixture hold/release control now holds native Git until the receiving text is observed, then releases it and verifies Pi onboarding. No production timing or progress semantics changed.
- **Busy deletion:** `062f480f` introduced both the test and the shared busy definition on 19 October. `agent_settled` sets state to `idle` before native-history publication completes, and automatic naming can still be running. Both correctly count as `turn` activity. Waiting only on status `idle` therefore races with legitimate work under load. Reuse the existing `quiescent` harness helper before asserting idle deletion. The earlier assertions still require every active turn to block both check and deletion and retain all four live children; the later assertions still prove checks do not stop idle Pi and deletion does.
- **Lost accepted reply:** the additional gate-only failure named in the issue passed the initial focused run unchanged. Repeat/full-gate results below determine whether it needs further action; no speculative product change made.

## Decisions for later review

Keep automatic login on observed stream expiry rather than restoring the old explicit-retry expectation: the intentional authority-lifetime fix must remain. Keep history publication/naming protected by busy classification rather than permitting deletion as soon as the run status becomes idle. Replace transient clone timing with explicit fixture coordination rather than slowing production or extending a guessed sleep.

## Validation

All host/browser evidence is synthetic, same UID; no live server, deployment or distinct-UID isolation claims. Focused self-review checked that each changed test still distinguishes the relevant wrong implementation: an expired relay left alive, missing receive progress, active work allowed to be deleted, or idle children stopped by a read-only check.

- Dependencies installed with `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
- `go test ./internal/daemon -run '^TestBusyConversationsHoldPlacesAndBlockDeletion$' -count=10 -v`: passed 10/10.
- `OH_PORT_BASE=15400 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npm run test:e2e --prefix web -- --grep 'expired session ends|synthetic slow native clone|lost accepted reply recovers on HTTP' --workers=1 --repeat-each=5`: passed 15/15, each case 5/5 on its own fresh host, serially (75 s).
- `./scripts/test-web-fast.sh`: passed (25 s).
- Full clean gate: pending at this evidence commit.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed before the evidence commit.
- `issuectl doctor --json`: passed; reports existing non-AVIF attachments, no schema violations. The installed CLI is 0.21.0; its repo-local Pi skills were refreshed, with no tracked file changes.

## Failure / incomplete-command inventory

The baseline browser command failed only on the obsolete expiry expectation (two other cases passed). During discovery, a guessed `github-clone*.spec.ts` glob matched no file, and an attempted read of the baseline error-context file after the next Playwright run had cleared test-results found no file; source/history and captured process logs supplied the needed evidence. No external service or required review failed. No independent LLM review was requested/run because changes are test-only. Full-gate outcome will be appended after the committed-tree run.
