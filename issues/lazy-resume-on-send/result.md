# Result

A browser conversation without a running Pi opens as readable native history
with an enabled field: no "Vain luku" bar and no "Jatka keskustelua" anywhere
(the explicit continuation control and its browser path are removed). The next
send starts Pi on the saved session and delivers the message once. Opening,
reading, scrolling or reconnecting never starts Pi. Terminal-origin history
stays read-only. Jari's decision is recorded as ADR 0018.

## How

- **Daemon (authority unchanged).** `internal/daemon/held_linux.go` holds
  messages sent while Pi is not running, in order, under the browser's command
  IDs (receipts `held`, then `pending`/`accepted`/`rejected`, or `cancelled`).
  A send to a conversation without a handle checks the browser-origin marker in
  its Pi lock file and its workspace, then starts Pi through the existing
  continuation proof (`resume`, formerly `continueEnded`), which still requires
  the previous child to be reaped, the lock free, a stable native history and
  no observed writer. Held texts reach Pi joined into one prompt; every joined
  ID shares the outcome. `cancel_held` returns exactly the texts still held and
  stops a Pi started only for them. A failed start keeps them (`start_failed`);
  `continue` or the next send retries. A child that dies mid-turn leaves the
  conversation `stopped` and `interrupted`, never a running turn.
- **Status without a handle** is synthesized from the origin marker and the
  native file, takes no lock and starts nothing; the snapshot offers such
  conversations as resumable (`control: transfer_possible`,
  `agent_resume: supported/browser_origin`), so links open the conversation view.
- **Browser.** `web/src/app/heldMessages.ts` posts held messages one at a time,
  resolves them only from the daemon's held list and receipts, never reposts a
  spent ID, and shows a message as uncertain (copyable) when no evidence remains
  (for example after a daemon restart). A previous uncertain send no longer
  blocks a new message while Pi is not running.

## Acceptance evidence

Synthetic, host-backed (real gateway, daemon controller, its restart fixture
and fake Pi, same UID); not live-host or distinct-UID evidence.

- **Real daemon restart, no read-only state, exactly-once first send:**
  `queued-send.spec.ts` "@lazy-resume after a daemon restart …": after
  `/fixture/daemon-restart` and reloads, the field is enabled, no Vain luku or
  Jatka; the first send is answered; one POST, one native user entry, none
  redrawn after a reload.
- **Opening does not start Pi:** the same case scrolls, reloads and then checks
  that the status is `stopped` and the daemon has no handle for the
  conversation. Go `TestHeldMessagesAcrossDaemonRestart` counts Pi launches
  around the status read.
- Also: Stop before Pi runs returns the text and Pi is stopped again (browser
  and Go); a lost Stop reply still returns the text once; reload while held;
  failed start with retry; crashed turn then send (`lab-conversation.spec.ts`).
- **Coordinated with `composer-and-new-conversation`:** same mechanism; see that
  issue for creation.

## Checks run (final tree)

With `umask 077`, `TMPDIR=/var/tmp/ohq`, `OH_PORT_BASE=23800`,
`OH_BROWSER_WORKERS=4`, shared Chromium cache:

- `scripts/test-web-fast.sh`: format, lint, typecheck, 155 unit and 133
  component tests passed.
- `go test ./internal/daemon ./internal/gateway ./internal/cli`: gateway and cli
  pass; daemon passes except six Pi credential/device/model/startup tests that
  fail identically on the unmodified base (environmental, recorded below).
- Contracts: `validate_contracts.py` valid; `scripts/check-generated.sh` clean.
- Full default browser suite (`scripts/test-focused.sh --area browser`): 204
  passed, 2 skipped, 2 failed: the base-failing account-settings case, and
  "malformed host status fails closed", which had started waiting on the loading
  view's now-visible field; the test now waits for the opened header and passed
  3/3 alone. Lab suite: 40 passed, 2 failed, both base-failing stream-cursor
  cases. `queued-send.spec.ts` 8/8, `new-conversation-placeholder.spec.ts` 6/6
  five runs in a row.
- `python3 scripts/validate-project-view.py` valid; `git diff --check` clean.

Pre-existing failures, each reproduced on the unmodified base worktree:
`TestPiCredentialsNative`, `TestPiCredentialsUnsafeAndRawReferences`,
`TestPiCredentialsAPIOnlyReadinessAndReplacement`, `TestPiDeviceNativeAndOwnership`,
`TestPiModelsNativeDefault`, `TestPiStartupChecksNotRepeated`;
`account-settings.spec.ts` "native key add, suffix, provider switch and
confirmed removal"; `lab-conversation.spec.ts` "expired combined cursor waits
for a newer snapshot" and (intermittently) "combined stream reconciles a forced
gap". The full clean gate was not run (not a merge precondition).

## Review

`/llm-review`: finder gpt-6-astra, verifier claude-fable-5-1 (two calls,
high-risk surface). Six findings, all confirmed and fixed: a lost Stop reply
could drop the text; old history could clear an uncertain message; the creation
view kept one workspace's messages when opening another; a direct send in the
readiness window could strand held messages; joined receipts stayed pending
when Pi died; a held first message lost the chosen model. Each has a Go or
browser test where it was a delivery path. Model-performance logging failed
with the known SSH-to-self refusal (exit 3) and is not logged.

## Prototype comparison

Paired captures and deviations are in `../composer-and-new-conversation/`
(`shots/`, `result.md`); the stopped-conversation states are `stopped`,
`stopped-waiting`, `stop-returned` and `failed`.

## Decisions for later review

- Held messages live only in daemon memory, like receipts. A daemon restart
  while a message waits loses it from the daemon; the browser then shows it as
  uncertain with its text and never resends it.
- A crashed or stopped Pi in this daemon incarnation is treated like a restart:
  the conversation is resumable on send, not "Valmis".
- Archiving is refused while messages wait for a starting Pi.
- The `continue` route remains as the retry of a failed start and for the
  explicit proof; nothing in the browser offers "Jatka keskustelua".
- After a turn interrupted by Pi's exit, "työn päättymistä ei voida vahvistaa"
  is shown until the next message.
