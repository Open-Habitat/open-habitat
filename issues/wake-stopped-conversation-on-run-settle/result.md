# Result: wake a stopped conversation when what it waited for ends

Both parts of Jari's 30.10. decision are implemented.

- **A Pi that waits is not stopped for idleness.** A background process
  already kept a Pi busy. Now a Pi whose conversation created a Taskfleet
  run that still works on its own is not stopped either. This is checked at
  each idle expiry from Taskfleet's creator-session attribution, and an
  unreadable inventory holds the Pi. There is no time limit on either kind
  of wait. Memory stays bounded by the per-person limit of four live Pis: a
  Pi held only by a run still gives up its place to another start, after
  every truly idle Pi (`pi_activity_linux.go`).
- **Wake on settle (option 2).** Once a minute the daemon looks at stopped
  conversations whose branch shows a cut-off, unreported background process
  that would have woken the agent. A cut-off `taskfleet run wait` for the
  conversation's own runs wakes it once those runs settle the way the wait
  would have returned: all of them by default, the first with `--any`,
  terminal statuses only with `--terminal`. Any other cut-off waking process
  wakes it at once, because it can never report back. After a daemon restart
  the native histories are scanned once for such conversations
  (`wake_linux.go`).
- **How the wake works.** Pi starts the way it does when the person types.
  The daemon then asks the companion (`op: "wake"`) to send the agent its
  catch-up as a turn of its own (`pi.sendMessage(..., {triggerTurn: true})`).
  The catch-up says Habitat woke it, why, and that nothing was re-run.
  History shows the rest marker as *Habitat herätti agentin …, koska …*
  (contract `restart.woke`: `settled` | `cut_off`).
- **What always wins.** A person's stop wins, including after a restart:
  `stopFor(person)` makes the companion record an `oh-person-stop` entry in
  the branch, and the scan treats the processes open at that entry as the
  person's. Archive wins: visibility is read under the proof permit, and
  archive refuses while a wake is in flight. A person's message sent while
  the wake is in flight is held and delivered after the wake's turn.

## Evidence

- Go: `go test ./internal/daemon` passes. New tests:
  `TestIdleStopSparesAPiWaitingOnItsRun`,
  `TestRoomTakesTrulyIdlePiBeforeOneWaitingOnARun`,
  `TestStoppedConversationWakesWhenTheAwaitedRunSettles`,
  `TestCutOffWaitsWakeAtOnceButThePersonsStopHolds`,
  `TestThePersonsStopAfterATypingWakeHoldsAcrossARestart`,
  `TestDeclinedWakeRestsOn`, `TestRestartCutWaitWakesAfterTheRunSettles`,
  `TestAMessageSentDuringAWakeWaitsForItsTurn`,
  `TestWaitOutcomeFollowsTheWaitsOwnCondition`,
  `TestBranchSaysWhichProcessesThePersonStopped` and
  `TestRestartNoticeCarriesHabitatsWake`.
- Node: the companion tests (`pi-device-test`, 41 pass) cover the wake op
  (one wake, never ahead of the person, a fixed reason only), a wake needing
  news of its own, and the person-stop entry.
- Contracts validated and regenerated. Web unit tests pass, plus
  `rest-card.spec.ts`.
- Review: independent `/llm-review`, with gpt-6-astra as finder and
  claude-fable-5-1 as verifier, followed by `/assess-findings`. All ten
  confirmed findings were fixed in this change. One narrow gap is accepted
  (below).

## Decisions for later review

- **Which conversations wake (option 2).** Only a conversation whose cut-off
  background process would have woken the agent. A conversation that only
  created runs and was not waiting is not woken. *Alternatives:* (1) wake
  whenever an owned run settles; (3) no wake. *Why:* the conversation itself
  said it was waiting, and nothing else gets an unasked turn. The issue's
  conductor recommended this too.
- **A cut-off non-Taskfleet wait wakes at once.** For example a `until curl
  …` loop with notify on exit. *Alternative:* never wake for it. *Why:* it can
  never finish, and the agent expected to hear back. The brief named this
  case explicitly.
- **A wait for runs that are not the conversation's own** counts as a plain
  cut-off and wakes at once. *Why:* the catch-up reports only its own runs,
  so their settling would never be news to it.
- **No time bound on the idle hold.** Taskfleet's own stall verdict ends a
  run's hold, and the per-person cap of four live Pis bounds memory.
  *Alternative:* a fixed cap such as 24 h. *Why:* Jari said a waiting Pi
  need not be stopped at all.
- **Horizon and loop bounds.** Rests and branches older than 24 h are not
  woken, which matches owed recaps. Each conversation gets at most one
  automatic wake per 30 minutes, and a declined wake is not retried for that
  rest.
- **A wake may make room.** Like a typing wake, it can stop the longest-idle
  Pi to get a place. *Alternative:* skip at capacity, as recaps do. *Why:*
  this resumes real work, and an idle Pi loses nothing native.
- **Accepted gap.** If the person stops a Pi within its first seconds,
  before the companion's socket exists, no stop entry is written. If the
  daemon then restarts within 24 h, an earlier cut-off wait could wake the
  conversation. Inside the same daemon the in-memory stop cause still vetoes
  it. *Alternative:* a durable daemon-side veto file. *Why:* that would be
  a new store; the window is a few seconds and needs a restart on top.
- **The wake text comes from the companion.** The daemon sends only a reason
  code (`settled` | `cut_off`), never text, so the process socket gains no
  channel for injecting prompts.
