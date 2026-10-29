# Result: why the conductor's Pi ended mid-reply, and the fix

## Cause (established and reproduced)

Not the >1 MiB branch. In Pi 1.3's RPC mode `message_update` carries only the
delta (`toJsonEvent` strips `partial`), and each delta frame is ~250 bytes
whatever the session size. A live measurement on Birch (real Pi + claude-bridge,
one 50 KB `write` call) gave 7454 frames, the largest 105 KB (`agent_end`);
`toolcall_end`, `message_end` and `tool_execution_start` each carry the whole
call (~53 KB). Both incidents streamed for 12 s and 49 s, far too short for
megabyte output.

What the measurement did show: the bridge releases a tool call's argument
deltas **all at once when the call is complete** — 7408 of 7412
`toolcall_delta` frames arrived within one second, 2398 of them within 100 ms,
after 160 s of silence. The daemon's reader (`pi_rpc_linux.go` read()) put
events on a 128-slot queue with a non-blocking send and, when it was full,
"poisoned" the channel: `overflow` + `p.in.Close()`. The controller's drain
(lock, several JSON decodes, journal publication per frame) is slower than the
reader, so a replay of that burst through the real reader and drain closed
Pi's stdin after ~150 frames, every run. Pi shuts down on stdin EOF
(`rpc-mode.js` onInputEnd → `runtimeHost.dispose()`), which fires the bridge's
abort → Claude Code writes "[Request interrupted by user]". Pi's own stdout
backpressure (the agent awaits it per event) is why the assistant message never
reached `message_end`/the session file. Nothing was logged: that path wrote no
diagnostic, and the exit watcher called the end a "crash".

This matches both incidents: the model was writing a long tool call (Python
splice / release brief), the end came when the call finished generating, and
the last saved entry was the previous tool result.

## Fix

- The reader waits for the controller when the event queue is full instead of
  poisoning at once; Pi waits for its stdout in turn, so memory stays bounded
  by the same queue. Only a controller that has consumed nothing for 30 s
  (`piEventStall`) still poisons the channel.
- Notification frames over 1 MiB (any type except `response`,
  `extension_ui_request`, `queue_update`, which are needed whole) are reduced
  to type plus message/tool/stream-event identity (`boundedPiFrame`) instead of
  ending Pi. This was not the cause here, but `toolcall_end`, `message_end` and
  `tool_execution_start` carry a whole tool call and can grow.
- Every site where the daemon closes Pi's stdin records why (`endInput`). The
  exit watcher combines that with Pi's exit status (`crashDetail`), logs
  `conversation_pi_ended` to the service journal, and passes it to the next Pi
  as `OPEN_HABITAT_STOP_DETAIL`; the catch-up then reads e.g. "Pi ended without
  being asked (Habitat closed Pi's input after no reply from Pi to
  get_commands within 4s, which ends Pi; Pi exited with status 0)" and keeps it
  in `details.stopped.detail`, so it is in the native session file.

Regression tests: `TestToolcallDeltaBurstDoesNotEndPi` (the measured burst
through the real reader and drain) and `TestPiRPCEventBurstWaitsForConsumer`
both fail against the old reader; `TestPiRPCStalledConsumerPoisonsWithCause`,
`TestOversizedNotificationFramesAreBounded`, `TestUnaskedPiEndRecordsItsCause`,
and the catch-up test in `pi-device-test/catch-up.test.mjs`.

## Decisions for later review

- **Stall limit 30 s before poisoning.** Alternatives: block forever (a stuck
  controller would freeze Pi silently), or coalesce deltas in the reader (more
  code, still needs a bound). 30 s is longer than any request deadline, so a
  request times out first and records its own cause.
- **The person's rest card does not show the detail.** It travels in the
  agent's catch-up and the service log only; showing it in the browser would
  change the rest contract (`contracts/v1`) and the card's wording, which is a
  product choice. Easy to add if wanted.
- **No catch-up, no durable record.** Jari's rule (2026-10-28) that a rest with
  nothing cut off and nothing settled tells the agent nothing still holds, so
  such a crash is recorded only in the service log. A crash mid-turn (this
  incident's class) always produces the catch-up. A daemon restart before the
  next wake also loses the detail (the cause becomes "restart"), as with every
  rest fact.
