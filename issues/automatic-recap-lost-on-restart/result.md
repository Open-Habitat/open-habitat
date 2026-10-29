# Result

The automatic recap's timer (`scheduleAutomaticRecap`) lives only in the
daemon's memory and is armed only when a turn settles, so a restart before it
fired lost it for good: Pi was stopped and no turn would settle again.

A starting daemon now derives the owed recaps from native history alone
(`internal/daemon/recap_resting_linux.go`): browser-started, unarchived
conversations whose latest message is the agent's, with no recap through it,
at least `firstAfterTurns` completed turns, and that message within 24 hours.
Each is due its delay after that message's native timestamp (immediately if
already overdue). For each, one at a time, the daemon starts Pi through the
ordinary continuation proof with a new start kind (`startRecap`), runs the
same `/oh-conversation-recap automatic` the timer would have, and stops Pi
again. No store was added.

A recap-only Pi (`recapOnly`) does not count as woken: the rest card keeps
*restart* and `awake: false`, the agent's catch-up still comes with the
person's next message, and a failed start rests on quietly instead of showing
a start failure. The person's wake, send or `!` command makes the Pi theirs
and it is not stopped; neither is it when the person reported presence while
it ran (it is left to the idle stop). The start never stops another Pi for
room and leaves one live place free.

Evidence: `web/tests/recap-resting.spec.ts` (second case) ends a turn while
the recap delay is still running, restarts the daemon, and sees an automatic
recap written, shown on the card, Pi back to `stopped`, no wake, rest still
`restart`. `recap_resting_linux_test.go` covers the native derivation and the
turn count. `go test -race ./internal/daemon` passed. Review: independent
`/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1) and
`/assess-findings`; two confirmed findings fixed (a recap-only start failure
surfaced as `start_failed`; `makeRoom` could stop a person's idle Pi), one
mitigated (see below).

## Residual

A wake or send landing during the few seconds the recap-only Pi is being
closed gets the same 409 as one landing while the idle stop closes a Pi; a
refused wake falls back to the send. Not new with this change.

## Decisions for later review

- Horizon 24 hours and at most 8 conversations per daemon start, newest
  first. Alternatives: only the person's delay window (would miss Jari's
  34-minute run of restarts), or no bound (could start dozens of Pis after a
  long outage). A day covers a night of upgrades and a person returning the
  next morning, which is what a recap is for.
- The daemon starts Pi on its own after a restart, which it did not before.
  Alternative: make the recap when the person opens the conversation; rejected
  because opening a resting conversation must start nothing (rest card,
  27.10.), and the recap would then not be ready on arrival.
- Only conversations the browser started (browser-origin marker) are
  considered; a terminal Pi's conversation never had an automatic recap.
- A turn cut off before the agent answered (latest message the person's) is
  left to the rest card's catch-up, not recapped.
- A failed owed recap is tried once per daemon start, like the timer's single
  attempt per message within one daemon.
