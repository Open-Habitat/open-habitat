# Result

Fixed the test, not the product. No user-visible behavior changed.

## Cause and reproduction

Conversation creation calls `refresh()` in `App.tsx`. Its snapshot carries the
new daemon instance, so `ConversationJournal.resume()` closes the old silent
stream, cancels its silence timer and connects using the new cursor. That is
correct recovery, not a skipped watchdog. This creation refresh predates the
recent rail changes (a0f646823, 2026-10-02).

Temporary before/after-clock trace logging reproduced the reported assertion
failure with four workers, 4× browser CPU throttling, 0–250 ms reply jitter and
six repeats: 11 cases passed, one failed. In the failure the title and ball
assertions passed, and `cursor:new-instance → stream:connecting → stream:open`
was already recorded before advancing time. No `silent` entry followed the
jump. Passing repetitions often emitted `silent` only after that same successful
recovery: the jump was exercising the replacement stream, not the original
silenced one. Incoming events update `heardAt`, so whether that healthy stream
looks silent across a clock jump depends on event/timer ordering. Waiting longer
for a diagnostic is not the correction.

The original gate artifact directory was no longer present. The new reproduction
logs and failing Playwright trace are retained outside git at
`/var/tmp/agent-keep/rail-title-restart-silent-trace-flake/` (particularly
`diagnostic-repeat.log` and `reproduced-results/`). These are synthetic fixtures.

Checked the suspected recent changes: place toggles change navigation/mounted
views, empty-section changes affect presentation, and the browser-card journal
diff adds tool report arguments/output. None changes the silence watchdog or
snapshot instance replacement. No evidence identifies these as a product trigger.

## Correction and review

The spec scopes diagnostics to the interruption, retains the daemon title and
rail title/ball assertions, and polls for a new-instance cursor followed by an
open stream. It accepts snapshot-led or watchdog-led recovery, and advances the
clock only if the new instance has not already been observed. No timeout grew.

Focused self-review was chosen: only a browser assertion and its clock driving
changed; no product stream, session, contract, daemon or authorization code
changed. The final assertion cannot pass on the pre-restart open event and still
requires both visible convergence and a replacement stream. Silence detection
itself remains covered by the existing fake-timer unit test, “reopens an open
stream that stays silent, never one that carries heartbeats”; it checks live
heartbeats, expiry, the closed old source, new source and cleanup. Removing the
strict browser `silent` assertion loses no reliable watchdog coverage: the old
browser test was already satisfied by silence on the wrong stream.

## Verification

Tested base `50cfd878d` with final spec blob
`3f9dbcea37aa188100b20e799a3fbfe57c50392d`:

- `./scripts/test-focused.sh --area browser --spec rail-title-restart.spec.ts`,
  `OH_BROWSER_WORKERS=2`: **2 passed**.
- Named Playwright spec with `--repeat-each 3`, two workers, 0–60 ms reply
  jitter: **6 passed**.
- Named Playwright spec with `--repeat-each 10`, `OH_BROWSER_WORKERS=4`,
  `OH_CPU_THROTTLE=4`, `OH_REPLY_DELAY_MS=250`,
  `OH_REPLY_SEED=rail-restart-diagnosis`: **20 passed**.
- `./scripts/test-focused.sh --area web`: **253 files / 2054 tests passed**,
  including the watchdog tests, plus static/component checks.
- `git diff --check`, project-view validation and `issuectl doctor --json`: passed.

Commands used `umask 077`, the scratch lease, private scratch for direct
Playwright, distinct ports and outer 300-second timeouts. Logs are beside the
reproduction evidence (`focused-final.log`, `repeat-final.log`,
`stress-final.log`, `web-final.log`). No whole browser suite, clean gate or live
installation verification was run; this test-only fix needs no live acceptance.

## Decisions for later review

- Accept either recovery mechanism and require the shared outcome (new daemon,
  reopened stream and correct rail). Alternative: hold browser snapshot replies
  to force watchdog-first recovery. That would prevent the ordinary creation
  refresh and test a different ordering; deterministic watchdog coverage already
  exists at the journal boundary. Changing production to force a `silent` trace
  after successful recovery would be incorrect.
