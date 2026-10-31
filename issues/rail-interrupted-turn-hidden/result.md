# Result: a turn cut by a daemon restart stays in sight as cut off

## Where the fact comes from

The daemon keeps no restart marker of its own beyond its start time (every
conversation without a handle rests with cause `restart` since then). Whether
the *turn* was cut is read from the native Pi session: `scanBranch`
(`internal/daemon/process_interrupted_linux.go`) already sets `turnCut` when
the last message on the active branch is a prompt, a tool call
(`stopReason: toolUse`) or a tool result the model never answered. Recaps,
notices and process notifications are custom entries, not messages, and do not
change it. The rest card already used this fact (`interrupted_turn`); the
snapshot and the status did not.

Live case on Birch (pilot.17, own user, read only): `pi:c0202001-…` ended
10:21:32Z with `assistant stopReason:toolUse` → `toolResult` (bash), then a
`conversation-recap` custom entry at 10:24Z: `turnCut` is true. Its status said
`interrupted: false`, `turn_settled: null`; the existing `interrupted` field
means only "this daemon incarnation saw the child end during a turn", which a
restart cannot know. Jari has since continued the conversation (entries at
17:29Z), so it no longer rests.

## Change

- Daemon, snapshot (`snapshot_linux.go`): a resting conversation (`rest`
  present, not awake) that is not archived gets `interrupted_turn: true` when
  its branch ends mid-turn. The branch scan is the existing stamp-keyed cache
  (`snapshotFacts.sessions.branch`), so each resting session file is read once
  per change, not per snapshot; archived ones are not read.
- Daemon, status (`observe`, `stoppedStatus`): the same fact as
  `interrupted_turn` while the conversation rests. `interrupted` keeps its
  meaning.
- Contract: `snapshot.schema.json` agent `interrupted_turn` (`const: true`).
- Rail (`railNow.ts`): such a row stays in Käynnissä as failed (red ball,
  never folded under Hiljaiset) with *Työ katkesi kesken*. A crash keeps its
  own *Pi kaatui*. The conversation's existing rest card says *Agentin kesken
  ollut työ katkesi* and wakes the agent on typing; the person's message ends
  the rest and with it the row.

Tests: `TestTurnCutByRestartIsReported` (daemon restart, finished turn not
cut, cut turn in status and snapshot, archived not read, continued clears),
`railNow.test.ts` (cut row, awake, person stop, crash), browser spec
`web/tests/rail-interrupted-turn.spec.ts` (real gateway/daemon/fake Pi: a slow
turn, `/fixture/daemon-restart` mid-turn, the row in the rail as cut,
snapshot and status say so, the rest card, continuing clears it). Also run:
`rest-card`, `rail-running-after-done`, `rail-now` specs, the daemon package,
web unit tests, contracts.

## Decisions for later review

- **Dismiss is archiving.** Alternatives: a separate "kuittaa" on the row.
  That needs a stored acknowledgement somewhere (a new store, or a native
  write, which needs Pi running). Archive already exists on the rail row and
  takes it out of sight; writing continues it.
- **A stop the person asked for is not shown as cut** (`rest.cause: person`,
  e.g. the agent CLI `conversation stop` mid-turn), though the daemon still
  reports the fact. The browser's Stop is an abort, which ends the turn with
  an aborted reply and is never cut. Found in review.
- **Old cut turns show too.** A conversation cut by any earlier restart and
  never continued is shown the same way; the host cannot tell which restart
  cut it. On Birch this was one conversation out of 132.
- **The row sits in Käynnissä, not Sinun vuorosi**, like a crash: it needs a
  look, but no reply is waiting.
- **Known limit, not changed:** the branch scan reads files up to 32 MiB, as
  for the rest card, `turn_error` and the process tray; a cut turn in a larger
  session is not reported (largest session on Birch: 5.6 MB).

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1) and
`/assess-findings`: the person-stop false positive was fixed; the 32 MiB limit
was dropped as inherited and rare.
