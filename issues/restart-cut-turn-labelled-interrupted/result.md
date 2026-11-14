# Result: restart-cut-turn-labelled-interrupted

## Cause

The cause was in the daemon's reading of native history, not in the client's
rail logic. When the daemon stops for a restart or upgrade, it closes each
Pi: the companion's shutdown op, then stdin's end, then SIGTERM. Pi disposes
its runtime and saves the running turn as an assistant reply with
`stopReason: "aborted"`, exactly as it saves the person's stop. The daemon's
branch scan (`scanBranchStream`) and the companion's `branchFacts` counted an
aborted reply as a finished turn, so:

- the snapshot had no `interrupted_turn`, and the rail's cut state did not
  hold. With no reply waiting for the person, the conversation fell into
  Hiljaiset, and its "nyt" was the time the abort was written;
- the history labelled the turn "Keskeytit".

Both symptoms in the report came from this one cause. The rows that looked
answered were conversations the person had written to seconds before the
restart; the restart aborted those new turns. A conversation whose agent had
answered before the restart has no running turn, keeps its `last_reply`, and
stays in Sinun vuorosi. The new browser spec covers that case and it passes.

## Fix

- The daemon tells the companion when a stop is its own (shutdown op
  `restart: true`, set by `stopFor(s, "restart")`). The companion then appends
  an `oh-restart-stop` custom entry when a turn is running, before Pi aborts
  it. An idle Pi gets no mark, so a restart does not touch finished
  conversations or their `changed_at`.
- Both scanners count an aborted or failed reply after that mark as a cut
  turn. The mark covers only the run it cut: a person's message, the catch-up
  that opens an automatic wake, or the first halted reply clears it.
- `interrupted_turn` in the snapshot also holds while typing has woken the
  resting Pi but the person's message has not reached it. This changes the
  contract description only.
- In the history (`timelineItems`), such a turn says "Katkesi palvelimen
  uudelleenkäynnistyksessä". The cut is known from the snapshot (rest cause
  restart with `interrupted_turn`) while the conversation rests, and afterwards
  from the restart catch-up notice with `interrupted_turn`.
- The synthetic Pi now aborts a running turn on stdin's end or SIGTERM, as Pi
  does, and writes the mark in the companion's place during
  `/fixture/daemon-restart`.

Validation: Go `./internal/daemon` (focused), companion node tests, web
focused (lint, typecheck, 1632 tests), contracts and generated-code check, and
the browser specs `rail-interrupted-turn` (mid-turn restart, plus a new case:
answered turn across a restart), `rest-card` and `process-tray` with
`OH_BROWSER_WORKERS=2`. With the scan rule disabled, the mid-turn spec fails.
An independent review (finder + verifier) found two attribution leaks: a mark
surviving into an automatically woken run, and an unanswered newer prompt
relabelling an older stop. Both are fixed with tests.

Conversations cut on 14.11. before this fix have no mark in their history and
keep saying "Keskeytit". The fix applies to restarts from now on.

## Decisions for later review

- Where a restart-cut turn sits in the rail: Käynnissä, marked failed with
  "Työ katkesi kesken", as the existing design already places a crash and a
  cut turn ("stays in sight like a crash until the person writes or
  archives it"). Not Sinun vuorosi, which is for a reply, a question or a
  new conversation. A reply that needs the person stays in Sinun vuorosi.
- Only the restart cause gets its own history wording. Other causes never
  stop a running turn through the daemon (the idle reaper and room only stop
  idle Pis; a person's stop is theirs).

## Residual (not filed)

`browser-conversation.spec.ts` "malformed host status fails closed without
rendering HTML" fails about one run in four, at the same rate on main and on
this branch, so it is an existing flake unrelated to this change.

## Live check

In a conversation, ask for work that takes a while (for example "run
`sleep 60` and then answer"). While it works, restart the person's daemon
(`systemctl restart open-habitat-daemon@<user>`). After the restart, the
conversation's row is in Käynnissä marked "Työ katkesi kesken", not in
Hiljaiset. Its last turn ends in "Katkesi palvelimen uudelleenkäynnistyksessä",
not "Keskeytit", and it keeps saying so after you write to continue. A second
conversation that had already answered before the restart stays in Sinun
vuorosi.
