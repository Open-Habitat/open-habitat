# Result

Taskfleet keeps an `--interactive` run `running` until someone merges or
cancels it, so the daemon now asks the worker's own Pi session whether it is
at work. `internal/daemon/spinoff_activity_linux.go` reads the tail of the run's
live Pi session in Taskfleet's state root: when the newest message is a
finished assistant reply (any stop reason but a tool call) and no extension
message has started a next turn, the run's spinoff state is the new `idle`.
The snapshot counts such runs in the new `spinoffs_idle` instead of
`spinoffs_working`.

In the browser the panel row reads *odottaa sinua* with a still ring (the
rail's own *Odottaa sinua* mark) instead of the dashed turning ring; the
worker view's header says *Odottaa sinua* without animation; the rail keeps
the parent in Käynnissä as *Worker odottaa sinua* without pulsing.
Tests: `TestLiveWorkerStateReadsPiOwnSession`, `railNow.test.ts`,
`BackgroundStrip.test.tsx`.

## Decisions for later review

- **Source of truth.** Pi's own session file, which Taskfleet already
  publishes as the run's live transcript, rather than the tmux pane or a new
  Taskfleet state. Alternative: a Taskfleet-side "agent idle" field; it would
  need the same reading in Taskfleet and a release before Habitat could use
  it.
- **Wording.** *Odottaa sinua* for both interactive runs (waiting for review)
  and autonomous ones that stopped without finishing: either way the person
  is the one who can move it. *Valmis* was the alternative; rejected because
  Habitat cannot tell finished work from a worker that gave up.
- **Pi only.** A Claude worker's state stays Taskfleet's; its transcript's
  stop reasons were not verified to say the same reliably.
- **Rail.** A conversation whose only live worker waits stays in Käynnissä
  (counted as waiting) so the waiting review is not lost from sight.
