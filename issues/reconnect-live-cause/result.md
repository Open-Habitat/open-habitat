# Reconnect: the live cause

Run `01m65tezkxjke05yjhnxfjt2je` (2026-10-30). The sections after "Earlier
investigation" are the previous runs' record, kept as they were.

## The named cause: snapshot reads cancelled by the next refresh

The page re-read the host snapshot by bumping one React key; the effect's cleanup
aborted the read in flight. Every refresh request therefore **cancelled the read
before it**. Through the live route a snapshot read takes seconds, and a running
agent turn asks for a refresh far more often than that, so **no read finished
while a turn ran**. In the build Jari used on 2026-10-16 (`651b2f92`) the page left
the stale phase ("Yhteys katkesi · tiedot voivat olla vanhoja", with Yhdistä) only
on a finished snapshot read, and every `snapshot.invalidated` asked for one at
once. After the 14:59:37 restart the event stream recovered, but the banner stayed,
and Yhdistä's own read was cancelled by the next invalidation in the same way:
"Yhdistä ei tee mitään". It recovered by itself once the turn stopped writing.

Evidence (metadata only, in [live-evidence-20261030.json](live-evidence-20261030.json)):

- cloudflared on Alder logs a cancelled request's path. After the 14:59:37 gateway
  restart, the page's stream to the new daemon instance was open at sequence 0
  (closed by the browser at 15:02:26, together with an `/auth/session` read: a
  Yhdistä click). Between **15:02:48 and 15:08:57 the browser cancelled 35
  `/api/v1/snapshot` reads**, often 1–2 s apart, while the daemon journal advanced
  from sequence 0 to **416 by 15:09:52**, i.e. a turn was writing throughout.
  The series ends at 15:08:57; at 15:09:52 the stream was at 416. The SSH forward
  (`omega-forward`, same PID all day) and cloudflared stayed up; the gaps of
  "origin unreachable" are only the release restarts themselves.
- The same starvation is still present on main, now behind the 1 s pacing that
  later work added: on **Birch (2026-10-23..30) Jari's snapshot read takes
  p50 2.9 s at the gateway and 36 of 62 reads were cancelled by the page**. On the
  test server today (about 0.9 s) it is rarer (3 of 99).
- Reproduced in the lab with fake Pi's tool-heavy run (`pitkä ajo`, a session
  write every ~60 ms) and a 2.5 s snapshot: main's `App.tsx` **answered 0 reads
  and cancelled 26** during the run; with the fix every read is answered (2–4) and
  none is cancelled (`lab-snapshot-single-flight.spec.ts`, 4/4 runs; counterfactual
  rerun against main fails).

Since 2026-10-27 (`09c6d518`) an opening stream also ends the stale phase, so on
main the banner itself no longer waits for the read; what remained was the
starvation: during a long turn the sidebar, process states, titles and the
confirmation of one's own commands (archive, rename) waited for the turn to end,
and a recovering journal waiting for a snapshot could be held off by repeated
Yhdistä clicks.

**Fix:** one snapshot read at a time (`App.tsx`). A refresh requested during a
read is answered by one more read right after it, which therefore starts after
every request so far; identity, session and login changes still abort at once.
Every read is bounded (20 s for a refresh, 60 s for the first load, which also
waits for Pi's status: the gateway's own finite ceiling) so a read stuck on a dead
connection cannot hold the slot. A timed-out read is reported as failed
(`[reconnect] snapshot-failed outcome: timeout`).

## A second, silent cause: a dead stream after sleep or a network change

Paths exercised on the host-backed synthetic setup, with a new opt-in edge relay
in the browser host (`BROWSER_HOST_EDGE=1`, `/fixture/edge?mode=freeze|cut|down`)
between the browser and the real TLS gateway, no route mocks:

| Path | Lab behaviour on main |
|---|---|
| daemon restart (`/fixture/daemon-restart`) | stream error → 409 → snapshot → new instance → open in ~50 ms, no banner |
| gateway restart (TLS server and auth replaced) | stream error → probe 200 → reopened in ~20 ms |
| test-server release (`/fixture/upgrade`: bundle + gateway restart) | as gateway restart |
| proxy idle reset (`cut`: RST on every connection) | reopened in ~3 ms |
| network loss (`setOffline` 15 s) | **no error, no banner, no record at all** |
| sleep / silent drop (`freeze`: connections stay open, no bytes pass) | **no error, no banner; the page stops following the host** |
| no route for 15 s (`down`) | **same as freeze** |

The live restarts take seconds, not milliseconds (Cloudflare answers 502 in
between), which the existing `reconnect-recovery` cases cover with a 503 probe.

The silent paths give the browser nothing to react to: the EventSource stays
"open", there is no Yhdistä because there is no banner, and the page simply stops
updating. The fix reopens the stream at the validated cursor (`journal.revive()`)
when the browser reports `online`, on the Page Lifecycle `resume` event, and when
a 15 s timer finds a gap over 90 s (the machine slept or the tab was frozen).
While recovering it asks for a snapshot instead. `reconnect-paths.spec.ts` freezes
the real connections, then wakes the page with `clock.fastForward` or returns the
network, and requires the page to follow a later daemon restart; both cases fail
on main (the restart never reaches the page) and pass with the fix.

Not covered: a stall that happens while the laptop stays awake and online (a
proxy that silently stops forwarding). The daemon's 20 s heartbeat is an SSE
comment, which EventSource never shows to the page. On the live route Cloudflare
ends a response that is silent for 100 s, and the SSH forward detects a dead link
in 90 s, so this case is bounded there.

## Validation

- `./scripts/test-focused.sh --area web`: format, lint, typecheck, 986 unit and
  component cases passed (one new journal case: `revive` reopens at the cursor,
  and while recovering only asks for a snapshot).
- Browser (`OH_PORT_BASE=12300`, 2 workers, umask 077): `reconnect-paths` 2/2,
  `reconnect-recovery` 10/10, `lab-snapshot-single-flight` 1/1 (and 4/4 repeated),
  `lab-snapshot-refresh-live` 1/1, `lab-long-stream`, `lab-live-turn`,
  `lab-outage-account` 5/5, `queued-send` 13/13, `process-tray` 6/6,
  `long-pause-composer` 2/2, `recap-resting` 2/2, `browser-conversation` tags
  409/reconnect/restart 6/6. In a full `browser-conversation` run one layout case
  (`own message shows every line it fits`) failed once under load and passed alone.
- `go test ./test/browser-host/` passed; `go vet` clean.
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) found one must-fix in the first version of this change: the
  first load had no deadline and could hold the single-flight slot forever. The
  verifier confirmed it; fixed by bounding every load. `/assess-findings`: 1 FIX,
  applied. Model-performance logging was skipped: that helper commits and pushes
  Fleetrepo, and this worker does not push.
- Exploration on the live hosts read only journal metadata (cloudflared and
  omega-forward on Alder, gateway/daemon `http_request` records on the test guest
  and on Birch); no bodies, cursors beyond the sequence, cookies or conversation
  content.

## Decisions for later review

- **Yhdistä joins a running read instead of restarting it.** Alternative: a click
  aborts the read in flight (the verifier's second suggestion). Chosen because
  restarting is exactly what cancelled every read when Jari clicked repeatedly;
  the 20 s bound covers a read that is really stuck.
- **Read bounds 20 s / 60 s.** A refresh over 20 s is on a dead connection
  (Birch's slowest is ~3 s); the first load waits for Pi's status too and gets the
  gateway's finite ceiling of 60 s, after which the gateway would have failed it
  anyway. A first load that times out now shows "Yhteyttä ei saatu" instead of
  loading forever.
- **Revive on wake/online/resume, no heartbeat event.** Alternative: make the
  daemon's heartbeat a named SSE event and watch it in the page, which would also
  catch a silent stall while awake. Not done: it changes the event contract and
  the daemon for a case that Cloudflare already bounds at 100 s.
- **The lab edge relay stays as test infrastructure** (opt-in per spec), so the
  silent-drop paths remain reproducible without mocks.

# Earlier investigation


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

## Live follow-up — 2026-10-21

Run `01m5e92nk3r09n7rpkwcq9yq06` checked the pinned guest's gateway and
`open-habitat-daemon@maintainer.service` journals from **2026-10-16
16:05:19 UTC through 2026-10-21 03:48:24 UTC**. Both journal queries exited
successfully. The first repaired release was **pilot.181**, source
`ee1ff753a1e134ce0955056d73bd9383f6eea3f3`: the local watcher receipt is
`verified`, and git confirms it contains repair/diagnostics `6850b868`.
Gateway and mapped daemon became ready at **16:09:57.131471 / 16:09:58.076676
UTC on October 16**. Thus the checked window includes the deployment boundary
and the whole subsequent interval. At inspection the guest selector was
`30316b6a54adabda422dbd3aed98e798204ddb41`, **pilot.268**, also containing the
repair; its watcher receipt is verified. Gateway/daemon were active, with
latest starts **October 21 03:32:22 / 03:32:24 UTC** and `NRestarts=0`.
The private Fleetrepo inventory's older pilot.257 row was not used as the live pin.

Only metadata was returned over SSH: readiness timestamps, classified event
counts, safe reasons, and fixed transport routes/statuses/timings/outcomes.
Raw journal messages were parsed on the guest and discarded; no conversation,
history, snapshot or SSE bodies, credentials, browser profile or user files
were requested. No service was restarted or configuration changed.
[Bounded evidence](journal-check-20261021.json) records the observations.

### What occurred (and what cannot be attributed)

- **91 gateway and 85 mapped-daemon readiness events** establish repeated
  interruptions/restarts, not an uninterrupted observation period. The release
  watcher deliberately restarts these services when installing product changes.
- There are **14 logged event-route 409s**, with no logged event-route 5xx.
  Example: gateway/daemon ready at **October 20 17:35:58.456826 /
  17:36:02.439853**; `/api/v1/events` returned **409 in 303 ms at 17:50:04.828892**;
  `/api/v1/snapshot` then returned **200 in 1402 ms at 17:50:06.421134**.
  This is consistent with post-restart cursor recovery, not evidence that the
  retry button was ineffective. A 409 alone does not distinguish expired versus
  foreign-instance cursor, and the later snapshot cannot be assigned to the
  same browser tab or prove a replacement stream opened.
- The sampled gateway snapshot records contain **422 completed 200s** and
  **205 client-canceled 503s**; the daemon has **201 completed 200s** and
  **509 client-canceled 200s**. A status written after cancellation is not proof
  of a server-origin failure. These counts are sampled records, not request
  totals or an error rate (`internal/diagnostic/request.go` omits fast reads).
- Four **`session_store_discarded / invalid_session_store`** records occurred on
  **October 17 at 05:37:51, 06:38:17, 06:39:28 and 06:45:19 UTC**. They establish
  rejected persisted gateway sessions at those starts, but without an actual
  click time/browser trace cannot explain this issue's original or a later
  ineffective retry. One other `daemon_route` failure on October 19 was for
  `conversation_title`, not the event transport.

**No attributable recurrence of the ineffective Yhdistä click was found.**
Disconnect/cursor-recovery episodes exist, so this is not a claim that no
connection interruption occurred. Fast successful streams and fast auth/cursor
rejections are omitted by the request logger; absence of a record is not proof
of their absence. There are no browser `[reconnect]` records in these journals:
they are not uploaded. Current production code additionally makes them **per-tab
opt-in**, following `ed03d66f` (October 20); the earlier always-emits description
above is historical.

### Still needed; issue remains open

Before reproducing in the affected tab, enable only the existing content-free
trace in DevTools: `sessionStorage.setItem("oh:debug-reconnect", "true")`.
Reload to trace startup, then retain only `[reconnect]` records around a failed
click, the approximate time/time zone and banner outcome. Disable afterwards
with `sessionStorage.removeItem("oh:debug-reconnect")`. Do not collect HARs,
cookies, raw cursors, response bodies or conversation screenshots. Correlate
that trace with service readiness and the selected release. No cause or code
fix is invented from the sampled journal, and the live-cause criterion stays
unchecked. This follow-up merges evidence only; it does not close the bug or
add a new Finnish try-it entry for unchanged functionality.

### Follow-up validation and limits

Evidence-only change: `python3 scripts/validate-project-view.py` and
`git diff --check` passed. `issuectl doctor --json` also completed successfully
(no schema/parse violations; existing attachment advisories are unrelated).
Self-review checked release ancestry, the sampled/canceled-request distinctions,
the opt-in diagnostic switch, and that the committed JSON contains metadata only.
No runnable files changed, so Go/web/Playwright checks and the full gate were
not run. No independent security review was needed for this read-only record.
The original live-cause acceptance item remains unverified, not silently passed.
