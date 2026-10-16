# Reconnect investigation — incomplete live attribution

Run: `01m52m9nh5x6c66h2t3wsh0817`.

## What the live evidence establishes

Using Fleetrepo's pinned root SSH route to `open-habitat-test-nbg1` (`203.0.113.10`), inspected only the gateway and `open-habitat-daemon@maintainer.service` diagnostic journals and transport responses. No history/conversation endpoints, credentials, browser profile, or conversation content were inspected or copied. The snapshot probe discarded its body directly to `/dev/null`.

- Around the reported 18:00 Finnish time / 15:00 UTC interruption, systemd stopped both gateway and mapped daemon. Gateway `service_ready`: **14:59:37.880784218Z**; daemon: **14:59:38.25500767Z**. Another restart was observed at **15:12:18 / 15:12:20 UTC**. The observed selected release was `651b2f927a45be92dde68ae8f6b70c4d1ae8bd29`, which includes the previous reconnect fix.
- A request as the gateway UID/GID `21003` to `/run/open-habitat/users/maintainer/daemon.sock`, Host `unix`, `GET /api/v1/events?after=ev1:11111111-1111-4111-8111-111111111111:0` returned **409**, error code **cursor_instance_mismatch**. This deliberately foreign cursor establishes the live restart-recovery contract, **not the response to Jari's actual click**.
- A mapped-socket snapshot transport probe returned **200**, **1.728 s**, body discarded. The daemon was running, not continuously failing. The only application warning in the inspected near-report window was `conversation_title / native_name_unavailable`, not evidence of a reconnect failure.
- The journals do not record individual event-stream requests, browser cursor, or reconnect clicks. They cannot distinguish a browser recovery loop, a hanging edge request, an expired browser cookie, or an old loaded bundle. No screenshot was attached to this issue's checkout: its directory initially contained only `item.md`.

**Named observed interruption: gateway and daemon restart. The cause of the ineffective live Yhdistä click is NOT established.** An invented-cursor 409 and passing lab tests are insufficient to claim otherwise. The issue remains open; this worker does not close it, merge a claimed live fix, or push it to main. The prepared changes below are independently testable improvements, not a proven resolution of the original live occurrence.

## Independently reproduced recovery defect and prepared repair

`ConversationJournal.resume` rejected a recovery snapshot when its cursor equalled the last accepted event. An invalid frame or conflicting duplicate can trigger recovery without advancing the accepted cursor or the daemon journal. Every subsequent snapshot then has that same cursor: snapshot refresh repeats indefinitely and explicit retry only requests another snapshot. This is a real client defect reproduced with an invented malformed SSE frame against the synthetic host; there is no evidence that Jari received that frame live.

The prepared repair accepts equality but still rejects an older cursor. Replaying **after** the accepted cursor is safe and does not replay a conflicting duplicate at that cursor. An earlier in-flight snapshot with a strictly older sequence remains rejected. Unit and browser regressions distinguish these cases.

The journal also reports connection progress/outcome, with an eight-second EventSource handshake watchdog and bounded existing retry backoff. The banner says **Yhdistetään…**, then disappears on confirmed stream recovery, or reports a safe network/server/permission failure. Response bodies never enter the banner. The existing retry control stays pending during an attempt. A 401 still clears identity state and returns to login; a 409 still requests a fresh snapshot.

The synthetic host now persists invented gateway sessions and can replace both the TLS HTTP server/listener and production gateway auth instance. The browser test separately restarts the actual mapped Unix HTTP server/controller, then the gateway TLS server, verifies that sign-in survives, and asserts progress, 503 failure and eventual recovery. This is host-backed synthetic evidence, **not real systemd, separate-UID or public-edge evidence**.

## Visual comparison

All captures are synthetic lab screenshots plus adjacent inert HTML at 1440×900, light theme, workspace `aurinkokello`, using `OH_PORT_BASE=29700` and `web/lab/session.mjs`.

- `before-disconnected` versus `after-failed`: same mounted workspace, sidebar and retained content; only the failure-detail text changes. The failure now identifies the event transport rather than repeating a generic stale-data explanation.
- `after-connecting`: progress text replaces the unchanged failure message; the retry control is pending, not repeatedly actionable. This is an intentional state distinction required by the issue, not a new page/layout design.
- `after-connected`: the banner disappears and the existing sidebar status says Yhdistetty. No persistent success toast was added, consistent with `design-system/design.md` (connection loss has one top notice, previous content remains readable).
- Also inspected `issues/reconnect-button-dead/before-disconnected.png` and `after-reconnected.png`. Their older workspace header, duplicate-plus/ellipsis state, card spacing and uncertain-creation notice are not current targets: those were changed by intervening workspace-icon/card work, not this branch. Within this branch no workspace, sidebar, card or composer CSS changes were made. Relative-time labels differ because the fixture clock advanced.
- The current navigation/control draft describes offline state, but does not supply a comparable retry-progress/failure banner screenshot. There is **no available current live screenshot or matched prototype-round screenshot for this issue**. Therefore the requested live/prototype paired visual verification cannot honestly be marked complete. The local before/after captures and earlier issue reference are supporting evidence only, not a substitute.

## Validation

- First browser start was blocked by shared-UID inotify exhaustion (`EMFILE` in Vite). Retried with `CHOKIDAR_USEPOLLING=1` and `OH_BROWSER_WORKERS=2`, without restarting any shared service.
- Focused reconnect suite: 8/8 passed before the final pending-button refinement. Final-tree checks and counterfactual results are recorded below when complete.
- Initial unit failures after adding the handshake watchdog were test fixtures that never simulated `onopen`; fixed those fixtures to model successful connections before advancing 30 seconds.
- An intermediate fast run passed all 145 unit cases but timed out in unrelated existing AgentTurn/Markdown component cases under concurrent load. These are retried in isolation; a partial run is not called a pass.
- `issuectl doctor --json` and `git diff --check` passed during preparation.

## Remaining evidence needed

For a fresh occurrence, retain only request **path, HTTP status, timing and safe error code**, the approximate click time, and which banner state appeared. No SSE payload, snapshot body, HAR containing credentials/conversation data, or conversation screenshot is needed. Correlate the failure with the guest service start times and the selected release. Do not infer that the synthetic invalid-frame regression explains the original report.

### Final focused evidence (implementation `7b1467a2`)

- `CHOKIDAR_USEPOLLING=1 OH_BROWSER_WORKERS=1 OH_PORT_BASE=29700 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec reconnect-recovery.spec.ts`: **8/8 passed**, 38.5 s. Includes Axe on the pending connection banner and a pending/disabled retry assertion.
- `VITEST_MAX_WORKERS=2 ./scripts/test-web-fast.sh`: **passed**, including format/lint/typecheck, **146 unit + 133 component** cases. Existing AgentTurn/Markdown timeout cases additionally passed in isolation: **15/15**, 4.83 s. Reduced worker count and serial browser→fast execution avoid competing with the other workers on this shared host.
- Counterfactual: restored just the old `<=` recovery guard and ran the **unchanged native cursor** browser case. It **failed as expected** waiting for a replacement EventSource (30 s); restored the fixed `<` guard afterward. The corrected positive case passes above. The test explicitly corrupts the EventSource, not the diagnostic fetch probe to the same URL: an initial attempt accidentally targeted the probe and did not distinguish the bug, so it was corrected before accepting this evidence.
- Recaptured all three final `after-*` PNG/HTML pairs from the lab built at `7b1467a2`. Inspected the images: pending keeps the banner/control height stable; failure retains the same workspace; success removes only the connection notice. Lab stopped afterward.
- Focused self-review checked generation/source fencing, aborted probes, handshake watchdog cleanup, older/equal/new-instance cursor behavior, identity/logout fencing, and that failure copy never contains host response text. No settings picker, sidebar catalog, process attribution, layout tokens or authority boundary was changed.

Full clean gate is run separately on the committed evidence tree; its outcome follows below. It is not inferred from the focused checks.

### Full-gate attempt and follow-up

`GOMAXPROCS=2 VITEST_MAX_WORKERS=2 CHOKIDAR_USEPOLLING=1 OH_BROWSER_WORKERS=1 OH_PORT_BASE=29700 ./scripts/ci-local.sh --clean --json` ran on clean committed `70237be9144d92a58501603f72488b62f485ab9a`. Checked `free -g` first: more than 2 GiB available. **Failed** after 676 s; no clean-gate receipt and no packaging/lab-suite completion are claimed.

- Static/unit/component checks and Storybook passed. Normal browser suite: **196 passed, 2 skipped, 2 failed**. The new reconnect cases passed.
- One failure was relevant: the existing `browser-conversation` 409 test asserted exactly two stream requests, i.e. that recovery stayed stuck forever at an unchanged cursor. Updated it to require a replacement real EventSource **after** resnapshotting; the strict-older-cursor refusal remains unit-covered. The corrected existing case passes in isolation (4.8 s). This is a necessary expectation change, not dismissal of a failing test.
- The other browser failure was the existing account-settings native-key/provider-switch case, waiting for **Poista avain…**. It also failed in isolation on this branch. Its baseline comparison is recorded below; it is **not** being waved through as a timeout that passes alone.
- Many Go cases rejected synthetic homes/runtime paths. Isolated three representative failures (`TestSnapshotDiscoveryAndSchema`, `TestPiStartupChecksNotRepeated`, `TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers`): they failed identically with this shell's inherited **umask 0002** and passed with a command-local **umask 022**. Go 1.27's `testing.T.TempDir` creates numbered subdirectories with mode 0777 masked by the process umask: 0002 yields group-writable 0775, correctly rejected by the production home guard. No machine-wide umask or security guard was changed.
- The gate's Go/contracts phase stopped at Go tests; downstream contract generation/validation, VM self-test and packaging were not reached. A partial gate is not a pass. Subsequent documentation/test corrections mean the final branch tree is not the attempted gate tree either.

- Baseline check for the settings failure: temporarily restored **all four changed runtime files** (`App.tsx`, `conversationJournal.ts`, `Status.tsx`, browser-host `main.go`) from original base `651b2f92`, leaving the original account-settings test untouched. The same isolated case failed at the same **Poista avain…** click after 30 s. Restored all four files afterward; git confirms no runtime diff from `7b1467a2`. Thus this failure is independent of the prepared reconnect change, but remains a real gate failure, not a pass.

- Final relevant browser rerun after correcting the existing 409 expectation: `./scripts/test-focused.sh --area browser --tag '@reconnect|cursor 409'` with the same loopback/cache settings, **9/9 passed**, 19.3 s. Format, lint and TypeScript checks passed again after that test-only correction.
- A full `go test -race ./...` follow-up with umask 022 passed gateway and most other packages, but still failed daemon cases that require **private (0700)** Pi ownership roots; those Go temporary directories were 0755. This confirms that 022 only repairs the non-writable-home subset, not the stricter private-root fixtures. A command-local 077 follow-up is recorded below. No unrelated native-runtime failure is being represented as verified by the web tests.

- With command-local **umask 077**, full `go test -race ./...` passed the previously failing ownership/runtime cases and every package except two daemon `/proc` census assertions (`TestPiWriterLiveOwnUID`: after writer exit `unknown`; `TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession`: pinned other session `unknown`). Both passed together in isolation under 077 (**1.222 s**). These are recorded as concurrency-sensitive assertion failures, not mislabeled timeouts. Overall Go/full-gate success is still **not** claimed.

## Handoff

Implementation is `7b1467a2`; evidence is `70237be9` plus the final existing-test expectation/evidence follow-up. The worker leaves a clean committed branch for review. It submits a blocked Taskfleet outcome because the original live-click cause and the requested matched live/prototype comparison remain unproved. No merge, push to main, guest mutation, shared-service restart or issue closure was performed. All lab/test children have stopped. The original live-cause acceptance item remains unchecked.

## Decisions for later review

Harvest run `01m52pn66wdad5be7t28j6kp4n` carries the prepared repair onto
current main (`e9bec7d5`), without claiming a proven live cause. The only cherry-pick
conflict was the synthetic gateway constructor: retained main's lab version
metadata as well as the repair's persistent invented sessions/restart factory.
Settings, sidebar, history and spinoff-tray work remain intact.

**Decision:** land the independently reproduced recovery repair despite the
missing fact about Jari's original live click. Missing evidence is recorded for
later review rather than blocking this bounded repair. The issue stays open and
its live-cause acceptance criterion stays unchecked. The prior run's blocked
handoff above is historical, superseded by this decision, not a new claim that
the original incident is explained.

The browser now emits small `[reconnect]` console records: UTC timestamps,
manual retry, stream connecting/open/error/timeout, HTTP request start/path/status and
time to response headers (or failure), and cursor comparison outcome (older/equal/newer/new-instance plus
whether recovering). EventSource does not expose its HTTP status; statuses here
belong to the separate fetch probe or snapshot request, not an invented SSE
status. There are no query strings, raw cursors, identity, credentials, error
text, response bodies or message content. Nothing is persisted or uploaded.
The gateway has no client-diagnostic intake route (checked its existing routes
and diagnostic references), so no server route or new diagnostic store was added.
Console-only output is deliberately the smallest useful addition; Tiedot is
unchanged.

Next time: collect only `[reconnect]` records around the click, approximate local
time and banner outcome; compare with the service restart times and deployed
release. `manual-retry` without `connecting` but with `retry-stopped` identifies
an inactive journal; a recovery `cursor: older` loop distinguishes snapshot lag;
`equal` followed by a new stream proves this deadlock was escaped; 401/403/409/5xx
probe/snapshot results distinguish auth, permission, cursor rejection and server
failure. A stream timeout with no successful probe suggests transport/edge
trouble. A successful stream plus stale banner points to snapshot/session
refresh rather than failed SSE. Do not collect HARs, cookies or payloads, and do
not attribute this historical live incident from synthetic evidence.

### Harvest validation and review

Commands below use disk-backed `TMPDIR=/var/tmp/rh` (initial runs used
`/var/tmp/reconnect-harvest`), command-local `umask 077` for browser/Go fixtures,
and a separate browser port base 31200.
The full gate is not run here: focused checks match this change and the project
explicitly does not make the full gate a landing precondition. Earlier gate
failures above remain historical failures, not successes.

- Final focused browser: `CHOKIDAR_USEPOLLING=1 OH_BROWSER_WORKERS=2
  OH_PORT_BASE=31200 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright
  ./scripts/test-focused.sh --area browser --tag '@reconnect|cursor 409'`:
  **9/9 passed**, 11.3 s. Includes actual synthetic gateway/daemon restart,
  equal-cursor malformed-frame recovery, console cursor/status/open assertions,
  and Axe on the pending banner. This is same-UID synthetic host evidence,
  not live-host/systemd/isolation evidence.
- Final `TMPDIR=/var/tmp/rh VITEST_MAX_WORKERS=2
  ./scripts/test-focused.sh --area web`: format/lint/typecheck, **149 unit and
  133 component tests passed**. The new diagnostics privacy/error tests initially
  used `.test.ts`, outside this repository's `.test.tsx` inclusion glob; renamed
  them before this final run so their response/query/exception-leak assertions
  actually ran.
- `umask 077; TMPDIR=/var/tmp/rh ./scripts/test-focused.sh --area go
  --go-package ./internal/gateway`: **passed**, race-enabled, 3.094 s. An initial
  run with longer TMPDIR `/var/tmp/reconnect-harvest` failed three Unix socket
  binds (`invalid argument` from overlong socket paths); shortening TMPDIR fixed
  all of them. No production security guard or host configuration changed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.

Targeted independent `/llm-review`, routine rigor: `claude-fable-5-1` reviewed the
final diff and current files, including the new diagnostics; `gpt-6-astra`
checked the concurrency/identity/diagnostic boundary independently. The narrower
second check was proportionate because reconnect and state recovery involve
racing probes, snapshots and old EventSource callbacks; a whole-repository panel
would not help this bounded change. The narrow check found no boundary defect.
The primary review did identify three locally confirmed UI-state problems:

1. During resnapshot recovery, an immediate failed snapshot left the retry
   pending until its eight-second watchdog. `snapshotFailed()` now ends progress
   and clears that watchdog on a definite snapshot failure. The watchdog remains
   only as a hung-read backstop. Added a frozen-clock browser regression (409 →
   failed snapshot → manual retry) and a unit check for watchdog cancellation.
2. Identity cleanup reset offline state but retained the old fixed failure copy.
   It now also resets the journal connection state; no old person's reason is
   carried into loading.
3. Failure detail replaced the stale/write-block and no-automatic-resend guidance.
   It now prefixes the normal state guidance, and the redundant App stale fallback
   is removed. No CSS or layout tokens changed. The earlier captures remain
   historical visual evidence; their exact failure wording is not this final
   prefix-plus-guidance wording.

These are fixes to the prepared repair, not evidence about Jari's historical
live cause. A batched verification of the primary review's candidates follows
in the local review record; no speculative residual issues were filed.

Final post-review reruns (same commands/options as above): **10/10 browser
cases passed**, including the frozen-clock immediate-failure regression;
**150 unit + 133 component cases passed**, including the new privacy tests and
watchdog cleanup/recovery case. Format/lint/TypeScript passed as part of the
fast web command. Gateway race tests still cover the unchanged host fixture
inputs. `git diff --check` and project-view validation passed after the docs
updates. The three review fixes are locally verified; Astra's batched source
verification confirmed them with the already-stale qualification on the first
and refuted only the visible-mobile-duplication subclaim on the third (responsive
CSS hides the duplicate span). The scratch review/assessment is under `history/`;
all durable findings and outcomes are recorded here. Model corpus logging was
skipped under this worker's no-push instruction because that helper itself
commits and pushes Fleetrepo.

Delivery: harvested commits `94626281`, `a84d2fc1`, `6e45df91` plus the diagnostic
and review-fix commit on this run branch. Tested runtime is the final staged
harvest tree; commit and merge bookkeeping may change these branch SHAs.
The conductor owns pushing and the next test-server release. No deployment,
shared-service restart, real-data capture or issue closure was performed here.
