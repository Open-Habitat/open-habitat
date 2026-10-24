# Result

A turn the person stopped now ends in a quiet row, "Keskeytit · 12.43"
(the full date is the time's tooltip), with a small stop square on the turn's
line. The command it interrupted shows as stopped ("keskeytetty"), not as a
red failure, and the stage row no longer says "1 epäonnistui". The mark comes
only from what Pi saved in its session file, so it is the same live, after a
reload, in read-only history and after archive and restore.

## What Pi saves for a stopped turn

`TestPiRPCNativeAbortDuringToolSettlesFirst` now reads the session file the
pinned Pi writes after an abort during a running `sleep 60`:

```
assistant  toolCall bash "sleep 60"        stopReason "toolUse"
toolResult "Command aborted"               isError true
assistant  content []                      stopReason "error",
                                           errorMessage "This operation was aborted"
```

Stopped while a reply streams, Pi saves the partial reply with stopReason
`"aborted"`. Stopped in a tool, it kills the tool and then saves the model
request that follows as an *error* carrying the AbortError text (Pi's own TUI
would show it as "Error: This operation was aborted"). The live `message_end`
has the same shape, so every stop in a tool also sent the browser a
`message_error` signal.

The daemon now reports an assistant entry whose stopReason is `"error"` and
whose errorMessage is exactly an AbortError text as `stop_reason: "aborted"`,
in history entries and in the live lifecycle signal (`piStopReason` in
`internal/daemon/history_blocks_linux.go`). The text only classifies and
never crosses the contract. `stop_reason` was already in the contract, so
there is no contract change. The browser marks a turn whose last native
assistant entry has `stop_reason: "aborted"`. It shows a tool result with
`failure_cause.kind: "aborted"` (Pi's "Command aborted", already classified
by the daemon) as cancelled, and it no longer turns the live
`message_aborted` signal into an "Agentin tila" notice in the running turn.

## Archive restore

A restored conversation has no running Pi (the existing restore spec asserts
`state: "stopped"`), so its first send is held by the daemon and starts Pi.
That is what differs from a conversation whose Pi runs. The new spec
reproduces it: archive, restore, send a slow message through the held start,
open the turn's work, stop mid-tool, and record every animation frame. A
frame-by-frame inventory of every `data-testid` on the page during the stop
found no banner, state-check button, uncertain notice, live notice or held
card in between. The only transient element was the screen-reader-only
"Keskeytetään…" status. The same was true for a stop pressed while Pi was
still starting. The one visible change during the stop was the interrupted
command turning red with "1 epäonnistui". The synthetic Pi did not write the
pinned Pi's trailing error entry or send its `message_error`, so the old
fixture also hid the second candidate, the live lifecycle notice. Both are
fixed above, and the fixture now writes what the pinned Pi writes.

I could not reproduce a restore-only flicker beyond those on the synthetic
host. The real Pi resuming an old session file is not exercised in the
browser harness. The KOKEILTAVAA line asks Jari to say what still flickers,
if anything.

## Changes

- `internal/daemon/history_blocks_linux.go`, `pi_events_linux.go`: abort
  classification (above).
- `web/src/components/AgentTurn.tsx`, `components.css`: `stopped` prop and
  the stop row, shown only once the turn has settled.
- `web/src/app/HistoryView.tsx`: `stopped` from the turn's last native entry;
  `toolOutcome` makes an aborted tool cancelled in saved and live rows and in
  the stage's failure count. `BrowserConversation.tsx` does the same for
  the live tail.
- `web/src/app/conversationEvents.ts`: no live notice for `message_aborted`.
- `test/browser-host/fakepi.go`: a tool abort writes and emits the trailing
  error entry as the pinned Pi does.
- Stories `Production/Turn stages` › `StoppedThenContinued` (Jari's
  screenshot case) and `StoppedMidAnswer`.

## Validation

- `go test ./internal/daemon` (umask 077, disk-backed TMPDIR, Pi SDK fixture
  installed): ok. The extended native abort test reads the pinned Pi's
  session file. The new `TestNativeAbortRecordedAsErrorIsAnAbort` keeps any
  other model error a failure and keeps its text off the wire.
  `go test -race ./test/browser-host`: ok.
- `./scripts/test-focused.sh --area web`: 642 tests. One failure, in the
  untouched `StartHere.test.tsx`, is green alone and already filed
  (`start-here-test-lazy-markdown-flake`). New unit cases: a turn saved as
  aborted is marked and its tool is cancelled with no failure count; a model
  error and a tool that failed on its own are not; the mark waits for the
  turn to settle.
- Browser: the new `browser-conversation` case (restored conversation, live
  and after reload, exactly one marked turn) passes, and it fails on the old
  code. The other stop and archive cases pass. Lab `slow turn … stops in one
  calm step` now also checks the mark, and lab-composer-area's Esc stop
  passes.
- Full gate: see below.

## Decisions for later review

- **Wording and time: "Keskeytit · HH.MM"**, as Jari suggested, with the full
  date in the tooltip. Alternatives: "Pysäytetty" (impersonal), or a date on
  older turns.
- **An abort is recognised from Pi's AbortError text.** The pinned Pi saves
  an abort in a tool as an error. Only the exact AbortError texts ("This
  operation was aborted", "The operation was aborted", "Request was
  aborted") count, so a real provider failure stays a failure. Any abort Pi
  makes counts as the person's stop, including one from Pi's own TUI in the
  same account, which is still the person. Alternative: a daemon-written
  stop record. That would be a second store of what Pi already saved, so no.
- **Only bash shows as stopped.** Pi's other tools return a generic
  "Operation aborted" error that the daemon does not classify, so a stopped
  `read` or `edit` still shows as failed under the "Keskeytit" mark.
  Extending `failure_cause` to them would be a contract change; it can follow
  if it shows up in use.
- **No live notice for an abort.** `message_aborted` no longer shows as a
  raw "Agentin tila" notice in the running turn. `message_error` still does
  for a real failure.
