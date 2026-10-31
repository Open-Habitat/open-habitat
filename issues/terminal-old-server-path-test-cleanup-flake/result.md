# Result

**Cause.** The leftover file in the fixture's temp `$HOME` was always
`.bash_history`. The fixture cleanup ran `tmux kill-server`, which only sends
SIGHUP to the panes and returns. A hung-up interactive bash then saves its
history into `$HOME` while `t.TempDir` is removing that directory. Only this
test types a command into a shell, so only it had history to save. The race
shows up under CPU load: 11 of 200 runs failed with four 50-run loops in
parallel, and 0 of 40 failed when the loop ran alone.

**Fix (test side).** Saving history on hangup is ordinary native bash
behaviour and the product leaves nothing behind, so the fix is in the test.
The new `killTmuxServer` in `internal/daemon/terminal_linux_test.go` records
the server and pane PIDs before `kill-server`, then waits up to 10 s for each
one to exit (a zombie counts as exited). The fixture and the three tests that
start their own tmux server all use it.

**Proof.** The same 4×50 parallel stress loop passed 200 of 200 after the fix,
with no temp directories left behind. The full `internal/daemon` focused run
passed, apart from one `TestEditorFilesRoundTripAndConflict` failure that
passed in two full reruns. That was a second sighting of the closed
`amazingly-long-train`, so it was filed again through intake.

## Decisions for later review

- No KOKEILTAVAA.md line: the change is test-only and gives nothing to try on
  an installation. Alternative: a "nothing to try" line, which would be noise.
