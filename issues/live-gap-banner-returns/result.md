# Result

## Cause

Neither candidate trigger, as such. The notice came from the live tail's
128-frame bound being reached in an ordinary long run, which steering only
lengthens. The cause is shown in a lab reproduction. The live records fit it,
but because the journal does not record events they cannot show it directly.

The daemon publishes a Pi run's `history.entry` events only when the run
settles. Those events are what prune the provisional tail, so during the
run nothing removes structural frames: each model turn adds roughly seven
(`turn_start`, thinking, tool-call delta and end, `tool.started`/`updated`/`finished`,
`turn_end`). After about 17 tool calls in one run the tail reaches 128 frames
on both sides:

- the browser set `live.truncated`, which drove "Tapahtumia jäi väliin"
  and was cleared only by a `history.entry`, i.e. at settlement. Mid-run
  entries kept arriving by history re-reads, which is why the
  intermediate answers kept appearing under the notice;
- the daemon gave up its tail (`ring_truncated`) and published no live
  frames for the rest of the run, although its comment intended "the
  rest of this assistant message".

`conversation-live-glitches` made streamed text extend one frame, so text
no longer exhausts the bound. Structure still did, and it accumulates
across the whole run instead of per message.

### Live evidence (Birch, 2026-10-26, journal in EET; only metadata read)

- Gateway/daemon `http_request` records: send at 12:53:57, steers at
  12:54:27, 12:54:38 and 12:55:25, GitHub callbacks (`oauth_callback`
  accepted, `credential_handoff`) at 12:54:56 and 12:55:12, next send
  12:57:29. No failed `/api/v1/events`, no daemon restart, no 5xx except
  client-cancelled snapshots (superseded reads, also before the sign-in).
  Fast successful reads (including stream reconnects) are not logged, so
  a stream reconnect cannot be excluded by the journal alone.
- Native session file of `pi:25e47b02-…` (entry types, roles, tool-call
  counts and timestamps only, no content): the run from 10:53:57Z to
  10:56:22Z is one Pi run of 27 tool calls with three steering messages
  delivered inside it. That is about 190 structural frames, well past 128.
  The previous run (10:51:05–10:52:43Z, 16 tool calls) stayed just under.

### Lab reproduction

`web/tests/live-long-run.spec.ts` drives a fake-Pi run with 40 tool-calling
model turns (new `pitkä ajo` prompt in `test/browser-host/fakepi.go`,
shaped like Pi's RPC: one `agent_start`, `turn_start`…`turn_end` per turn,
messages saved as they end). It samples the notice every 25 ms. Before the
fix it showed the notice from mid-run until settlement:

```
gap=false working=true ×46
gap=true  working=true ×51
gap=false working=true ×1
```

After the fix the run reports `gap=false working=true ×97`, with no gap samples.

## Fix

- Daemon (`events_linux.go`, `pi_events_linux.go`): `turn_start` resumes a
  tail that was given up earlier in the run, so live frames are published
  again from the next model turn (`TestJournalOverflowResumesAtNextModelTurn`).
- Browser (`conversationEvents.ts`): a truncated live turn resumes
  provisional display at the next `turn_start`, where a message starts
  whole.
- Browser (`conversationStore.ts`, `BrowserConversation.tsx`): the notice
  follows a new `LiveTurn.missed`, not `truncated`. It is set only where
  events were actually missed (a per-window sequence gap, or a window
  seeded from a snapshot behind events already routed). It is cleared
  once a native read *begun after* the miss has joined (unit test: a
  read already in flight at the gap does not clear it, the next one does).
  Giving up the tail at its bound is no longer reported as missed events.

## Decisions for later review

- A post-miss read clears the notice even while the in-progress, unsaved
  assistant message stays hidden until the next turn or its save. The
  notice is about native history, which is complete at that point. The
  review finder proposed keeping it until the stream is whole again, which
  would bring back a notice that lasts until the next turn.
- The daemon resumes at `turn_start` only after an overflow. It does not
  prune earlier turns' frames at every turn, which would keep the tail
  per message. Pruning would change what a browser opening mid-run gets
  from the snapshot and would reset the turn clock that reads the first
  `turn_start`. Long runs still give up the tail once per ~17 tool calls.
  Between that point and the next turn the current tool's live card is
  hidden (one tool call).
- The working clock still restarts at the next `turn_start` after the
  browser drops its fragments at the bound (the screenshot's 0:42 in a
  run over two minutes old). That predates this change and is not fixed
  here.

## Checks (Birch, worktree)

- `go test ./internal/daemon` passes, including the new overflow-resume test.
- `scripts/test-focused.sh --area web` passes, covering the new store and event
  unit tests.
- Browser `live-long-run.spec.ts` fails before the fix and passes after.
  `native-live-join`, `queued-send`, `browser-conversation`, lab
  `lab-long-stream` and lab `lab-live-turn` pass.
- Whole `npm run test:browser`: 379 passed and 23 failed. 22 of the failures
  were `bind: address already in use` on the fixed host port, because a
  parallel worker's suite was running. The other was an axe colour-contrast
  check on the untouched `start-here` page. All 23 pass when their specs are
  re-run alone.
- Review: `/llm-review` (gpt-6-astra finder, one candidate) and
  `/assess-findings` produced no confirmed findings. The one candidate is
  the first decision above.
