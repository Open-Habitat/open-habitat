# Creation deadline mismatch

## Cause and confidence

The production daemon gives an HTTP response **five seconds** by default, but
conversation creation waits up to **fifteen seconds** for Pi's initial native
state (plus up to twelve seconds of explicit-model validation). Creation did
not extend that deadline. The lab's Unix HTTP server had **no write deadline**,
so delaying a browser route never exercised this production failure.

[Live evidence](live-evidence.md) records the selected release, writable snapshot
facts, usable native default, gateway exchange failure and a bounded empty
creation probe. No conversation content was inspected or copied. The warm live
probe succeeded in 2.016409 seconds and was closed without sending a prompt.
**The exact historical failed browser request cannot be attributed conclusively:**
the logs lack path/duration correlation and the issue contains no attached
screenshot/request trace. The five-second mismatch is a confirmed defect and
reproduces the reported sequence, not proof that every original + failure had
that cause. In particular, browser-local creation guards cannot be read from the
authorized server APIs.

## Fix and distinguishing regression

Creation extends only its own response deadline to 45 seconds, leaving headroom
for the existing native budgets and staying below the gateway's 60-second
ceiling. Other request limits and admission checks remain unchanged. No retry,
second create request, new identity authority or browser-side history store was
added. No `web/src/` module was changed, avoiding the parallel UI workers.

The browser host now uses production's five-second write deadline, including
after fixture server restarts. A new `pi-slow-start` scenario delays fake Pi's
get_state response for six seconds; snapshot and event transport remain healthy.
The test delays the native child, **not** Playwright's HTTP routing. Home,
workspace and sidebar + must immediately display the existing disabled-composer
placeholder, receive a successful create reply, select that exact native child,
retain it after reload, and send only one creation POST.

With only the production deadline extension removed (new host deadline/scenario
and regressions retained), **3/3 cases fail with HTTP 503 instead of 200**. The
manual baseline reproduces uncertainty followed by a workspace landing after a
successful read; the newly created child exists despite its lost reply.

## Paired visual comparison

Captures use `OH_PORT_BASE=28800 scripts/lab.sh`, `web/lab/session.mjs` and its
`snapshot()` helper, with fresh invented lab homes and a 1440×900 browser.
Each image has its adjacent inert offline HTML. They are synthetic, not live.

- Home before clicking: [before](before-home.png) / [HTML](before-home.html),
  [after](after-home.png) / [HTML](after-home.html).
- Native startup pending: [before](before-pending.png) /
  [HTML](before-pending.html), [after](after-pending.png) /
  [HTML](after-pending.html).
- Lost baseline reply: [before](before-lost-reply.png) /
  [HTML](before-lost-reply.html).
- Settled after the same slow startup: baseline returns to the
  [workspace](before-settled.png) / [HTML](before-settled.html); the fix stays in
  the [new conversation](after-settled.png) / [HTML](after-settled.html).

Reference: the chosen `design-system/drafts/Etusivu.proto.html` (Työtilaosiot),
both the home state and its new aurinkokello conversation after clicking +.
Inspected screenshots are `.cache/prototype-plus-home.png` and
`.cache/prototype-plus-empty.png`; the committed self-contained draft is the
reproducible reference. The newer workspace/+ menu round
`rounds/2026-10-16-tyotilasivu` is a distinct feature proposal, not this issue's
explicit direct-create acceptance criterion.

Deviations, deliberately not introduced or silently redesigned here:

- The prototype creates immediately with no native startup state. Production
  must show an honest pending state and disable sending until a native handle
  exists. Header and composer remain in place during this wait; only status
  and admission change.
- The prototype's empty center says Pi starts with the first message. Production
  already starts a native child to observe its actual settings, then says
  `Aloita keskustelu`. A transport fix must not pretend the existing child does
  not exist or invent a model choice.
- The fake Pi has no native model choice, process bridge or Taskfleet inventory;
  production components therefore show `Malli ei tiedossa`, unavailable process
  and spinoff notices. These are explicit synthetic limitations, not a reason to
  hide genuine unknown state. Process presentation belongs to the parallel
  process UI worker.
- Home/card titles, recap content, five synthetic workspaces, Alice identity and
  hostname differ from the prototype's invented examples; they do not change +
  placement or intent. The prototype frame is 1080×900 inside its page whereas
  the lab app uses the 1440×900 viewport. No CSS/layout change is part of this fix.
- The prototype marks a newly created sidebar row immediately; the current
  daemon only projects it once the child is observed. The pending route does
  not invent a sidebar native ID. This pre-existing timing difference is not
  changed by extending the HTTP budget.

## Completion decision

Land the independently reproduced transport correction, but leave this issue in
`testing`, not `fixed`: the requested proof of the **original live cause** is not
fully available. Closing it as fixed would repeat the lesson this task was meant
to address. `KOKEILTAVAA.md` carries all three live entry points and the bounded
metadata needed if the original browser failure persists. No additional issue
is needed for the same unresolved report.

## Validation

Final commands/results follow after the committed-tree gate. No live browser
success, real-provider turn, separate-UID isolation or exact historical
attribution is claimed.

### Focused results and first full gate

On implementation `878bec42`:

- Fast web checks passed: formatting/lint/TypeScript, 140 unit and 133 component tests.
- Slow-native lab regression: 3/3; existing placeholder: 3/3; reconnect recovery:
  6/6. Commands were `scripts/test-focused.sh --area browser --spec <spec>`
  with `OH_PORT_BASE=28800`, two workers, `CHOKIDAR_USEPOLLING=true` and the
  existing `$HOME/.cache/ms-playwright` browser cache.
- `scripts/test-focused.sh --area go --go-package ./internal/daemon` and
  `./internal/transport`: passed with race detection. Contract checks passed.
- Initial development checks hit one unrelated 5-second unit timeout under
  severe shared-host memory pressure, and the first daemon package run lacked
  `internal/daemon/pi-device-test/node_modules`. After installing the declared
  synthetic SDK lockfile, both final focused commands passed. A reload assertion
  also timed out under that load; the final slow-native run passed all surfaces.
- Full clean gate on `878bec42`: **failed**, 730 seconds, no receipt. Started
  with `free -g` reporting 5 GiB available (the earlier 0–1 GiB readings were
  not used to start the gate). Web checks, Storybook, Go/race/contracts/docs and
  offline VM fixture checks passed. Normal browser: 190 passed, two intentional
  visual-capture skips, one failure in `warm controlled return reads neither
  status nor history`: three model discovery GETs instead of its budget of two.
  The browser failure prevented the lab and final packaging phases.

Focused self-review covered request authorization/framing before extending the
budget, the 45-second local versus 60-second gateway ceiling, no automatic POST
retry, unchanged identity guards, fixture deadlines surviving restart, and
new-scenario snapshot/event parity. It also found that the warm-return test's
two setup waits still treated a **visible disabled placeholder** as a completed
creation. Those waits now require an enabled composer before recording the
first route and measuring warm navigation. The final paint assertion remains a
visibility assertion: the performance test is still measuring visible retained
content, not waiting for a new status read. No request budget was relaxed.

The warm-return case passed unchanged in isolation (1/1). Its setup was corrected
anyway rather than treating that isolated pass as a green full gate. Rebased
cleanly onto `origin/main` at `883bfaa0`; incoming changes were issue/research
prose only and there were no conflicts. The rebased implementation is
`834245ca`, with the test-readiness correction in `3e72ce45`.

### Second gate and integration

The full standalone lab suite passed **34/34** before integration. A second
committed-tree clean gate on `0fd6b965` used `OH_GATE_SERIAL_HEAVY=1` (same two
browser workers; 6 GiB available before starting). It **failed**, 381 seconds,
with no receipt: all web/unit/component checks and Go/race/contracts/Storybook/
offline VM checks passed; normal browser had **190 passes**, two intentional
capture skips, and one timeout in the existing Unix-daemon-restart reconnect
case. That case lost its `Yhdistä` target during click actionability (the button
was detached by automatic recovery). The corrected warm-return measurement
passed. Lab and packaging were again not reached by the full gate.

Rebased cleanly onto local `main` at `a0154d96`, incorporating the other three
workers' settings, process UI and live-turn corrections. There were no conflicts
and no edits to their `web/src/` implementations. Final integration checks below
cover that combined runnable tree; no gate receipt from the earlier tree is
claimed for it.

### Final integrated evidence

On combined runnable tree `c44ac41d` (implementation `0dd28000`, readiness test
`7efacf1f`, base `a0154d96`):

- Fast web checks passed (140 unit, 133 component).
- Reconnect regression **6/6**, including the gate's exact daemon-restart case;
  warm-return regression **1/1**; placeholder regression **3/3**.
- Full lab suite **35/35**, including all three six-second native-start tests and
  the integrated live-turn coverage. The unrelated reconnect timeout therefore
  passed in isolation without changing that test or relaxing a timeout.
- Re-captured **all** paired images/HTML after integration. The baseline differs
  only by removing the production create deadline extension; it returns 503.
  Restoring the exact source returns 200 and stays in the new conversation.
  The final process-not-available notice is now the other worker's compact folded
  tray, rather than the old banner; this is the accepted process design, not an
  additional creation change. No new layout deviation was introduced here.
- Requested lab base remained `OH_PORT_BASE=28800`: baseline used 28801; after
  stopping it, the next start chose free port **44667** because 28801 was still
  unavailable. The worktree's recorded port was used; no other listener was
  stopped. Both manual hosts were stopped after capture.
- Standalone packaging covered the phase skipped by the failed gates: two
  reproducible archives compared byte-for-byte; verification, re-signed unsafe
  socket inventory rejection, relocated verification and tamper rejection all
  passed. Synthetic artifacts: `/var/tmp/oh-plus-package.uiZd1X`; archive SHA-256
  `16c833df76d85c3e5c98019a069fa4c7172cbd36a7b8b6ea7c324d081ca3c2e2`.
- Final Project View/issue validators and `git diff --check` passed.

There is **no successful full clean gate receipt**. Landing uses the brief's
explicit allowance for unrelated timeouts passing in isolation, plus final
focused, full-lab and standalone packaging evidence. The original report remains
`testing` for the live check, intentionally not misrepresented as conclusively
fixed. The live probe and limitations are fully recorded above.
