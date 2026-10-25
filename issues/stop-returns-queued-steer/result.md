# Result: Stop returns undelivered queued messages to the composer

## Cause

Pi's own session file for the reported conversation
(`~/.pi/agent/sessions/--home-maintainer-src-open-habitat--/2026-10-25T16-15-35-961Z_…jsonl`,
entries 325–328) shows the order:

- 17:53:20.041: Jari queued *Anteeksi. Olen mapleillä* as a steer.
- 17:53:25.379: the running tool returned.
- 17:53:25.381: Pi delivered the steer into the conversation at the turn
  boundary.
- 17:53:25.384–.861: the next model request started, and Stop's abort cut it
  before any output (`stopReason: aborted`, empty content). That is the
  *Keskeytit* row.

Pi takes a queued message off its queue at the moment it delivers it. So when
the Stop arrived, Pi's queue was already empty: the browser's `clear_queue`
returned nothing, and the message stayed in history. To the person it was
shown as sent and never answered. The second copy (17:53:33) was Jari's own
retype, as the corrected issue says.

Reading pinned Pi 1.3.0 turned up two more ways to lose or double such a
message:

- **Delivered after the clear.** The loop pulls a steer for its next turn
  before the session's queue list drops it. In that window a clear still
  reports it, yet Pi delivers it anyway.
- **Reply before the delivery.** Pi awaits extension hooks between removing a
  text from the queue and the user `message_start`. The daemon also read the
  clear reply and Pi's events on separate goroutines.

Separately, the browser only cleared the queue when its possibly stale status
showed one.

## Fix

- **Daemon** (`internal/daemon/pi_unanswered_linux.go`): follows Pi's own
  event order and tracks queued texts that Pi took off its queue (queue_update
  diff) and delivered (matching user `message_start`). Any model output clears
  that list (a thinking/text/tool delta, assistant content, or a tool start);
  so does the run settling.
- **Daemon `clear_queue`:** takes an opt-in `"unanswered": true`, which the
  browser sends only for Stop. The reply then carries `unanswered`: delivered
  messages the model never answered, plus messages Pi took for delivery whose
  `message_start` is still to come.
- **Ordering:** Pi's `clear_queue` response now goes through the ordered event
  drain, as `!` bash replies already did. It is reconciled exactly at its place
  among Pi's events, so a text comes back once whichever order the removal,
  delivery, reply and settle arrive in.
- **Attachments:** returned texts drop the daemon's own `Attachment path:`
  expansion lines (`writtenText`), so the person gets the message as written,
  with its attachment references, and a resend expands them again.
- **Large frames:** the >1 MiB frame reducer keeps the text of a user
  `message_start`, so an image-bearing steer can still be matched.
- **Browser** (`ConversationActions.tsx`): Stop always asks Pi to clear, then
  aborts. It restores unanswered texts first, then the still-queued steering
  and follow-ups, after the current draft. Nothing is sent.

## Evidence

- `go test ./internal/daemon`: the whole package passed. Two snapshot-schema
  tests need Python `referencing` (`requirements-ci.txt`); they passed with it
  installed in a venv and fail without it on Birch, independent of this change.
- `-race` on the queue/clear/bash tests: passed.
- `go test ./test/browser-host ./internal/cli`: passed.
- New daemon tests in `pi_unanswered_linux_test.go`: a scripted Pi that keeps
  Pi's native queue order. They cover:
  - delivered then Stop with an empty queue;
  - pulled for the next turn and still cleared;
  - taken but not yet delivered when the clear arrives;
  - output before the Stop (nothing returned);
  - the queue's own restore button;
  - a settle right after the clear;
  - both arrival orders of reply and delivery;
  - attachment un-expansion.
- Browser, `web/tests/queued-send.spec.ts` (13 passed), with three new cases:
  - still queued: back in the field, never delivered, nothing posted;
  - delivered, Stop before any answer (Jari's case): back in the field, once
    in history, also after reload. **Fails on the old code** with an empty
    field;
  - the agent already acting on it: stays, field empty, nothing posted.
- Other specs:
  - `browser-conversation.spec.ts` 70 passed;
  - `process-tray`, `command-cards` and `lifecycle-frames` passed;
  - the lab specs `lab-composer-area`, `lab-conversation` and `lab-raw-entry`
    passed;
  - web unit: 749 passed.
- Contracts: `--area contracts` clean. No `contracts/v1` file changed; the
  daemon's `clear_queue` request body is not schema'd.
- Independent review (`/llm-review`, GPT-6 Astra finder plus a fresh Astra
  verifier; Fable's CLI was unavailable): the reply/event ordering race and its
  follow-ups were found and fixed as above.

The fake Pi (`test/browser-host/fakepi.go`) now emits the user
`message_start` with its text, as Pi does.

## Not tested

Real Pi with a real model. The fake reproduces the native order of events,
not provider timing.

## Decisions for later review

- **A delivered but unanswered message counts as not received.** A queued
  message that Pi delivered, but that the stopped turn produced no output for,
  comes back to the field. It also stays in the conversation, because native
  history is Pi's and the daemon does not edit it. If it is sent again, the
  model sees it twice.
  - Alternatives: leave it (the reported bug), or hide the native bubble
    (contradicts native history).
  - Why: Jari experienced it as lost. Native truth, Pi's event order and not
    timing, decides which messages qualify.
- **What counts as an answer.** Any model output after the message: thinking,
  text, a tool call or a tool start. A partly answered message stays where it
  is.
- **Identical texts can collapse.** Two queued messages with the same text may
  come back as one, because texts are matched by value, as Pi matches its own
  queue. Safe side: nothing is ever sent twice.
- **Restore order and placement.** Restored texts go after the current draft,
  as before, and in Pi's order: unanswered ones first, then still-queued
  steering, then follow-ups.
- **Stop always clears.** Even when this view shows no queue, Stop asks Pi to
  clear first. That costs one cheap RPC per Stop. A refused clear still lets
  the abort go ahead.
