# Result

The worker view's terminal now watches the pane Taskfleet runs the agent in.
`workerTerminal` (`internal/daemon/spinoff_history_linux.go`) appends
Taskfleet's recorded `attach.identity.pane_id` to the window token
(`<socket hash>-<window>-<pane>`). The terminal route resolves the window
with the pane: the gateway and the daemon both accept the pane-qualified
form, and the daemon admits it only while tmux reports that pane in that
window with its own directory in the workspace (a window-only token is
still admitted by its active pane's directory). `watch` captures that pane
at the pane's own size instead of the window's active pane at the window's
size. A pane that
is gone, or belongs to another window, is refused like a gone window.
Tests: `TestTerminalTaskfleetWatchShowsTheNamedPane` (real tmux, a split
window whose active pane is a shell, a pane outside the workspace, the
active pane leaving the workspace), the gateway's relay test with a
pane-qualified token, `TestWorkerTerminalPointer`,
`TestSpinoffDetailCarriesWorkerFacts`.

## Decisions for later review

- **Pane in the token, workspace list unchanged.** The workspace terminal
  list's Taskfleet windows still show the window's active pane: the list
  has no run to ask which pane is the agent's, and reading every run's
  attach record for it would cost a `run show` per window. Only the
  worker's own view, which has that record, names the pane.
- **Refuse rather than fall back.** When the recorded pane is no longer in
  the window, the view ends as for a gone window; falling back to the active
  pane would show the wrong thing again.
