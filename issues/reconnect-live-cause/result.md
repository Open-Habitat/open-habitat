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
