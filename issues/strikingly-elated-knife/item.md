---
created: 2026-11-24
updated: 2026-11-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: release driver clean gate
source_ref: taskfleet:01m879wp05cw7z9d74adry2bfp/gate-tmux-env-leak
originating_run: 01m879wp05cw7z9d74adry2bfp
originating_run_kind: spinoff
---

# Browser terminal spec fails when the gate runs from inside tmux (caller's TMUX leaks in)

## Description

## Observed

`web/tests/browser-terminal.spec.ts:175` ("@browser-shell selection actions
stay outside every selected row at panel edges") fails deterministically when
the gate or a focused run is started from a shell that is itself inside tmux
(`TMUX` and `TMUX_PANE` set in the caller's environment), and passes when the
same command runs with `env -u TMUX -u TMUX_PANE`.

- Reproduced 3/3 with `scripts/test-focused.sh --area browser --spec
  browser-terminal.spec.ts --tag "selection actions stay outside every
  selected row at panel edges"` at `e1176c13d` and 1/1 at `0aaad5b69`
  (v0.1.7) from inside a tmux pane; 1/1 pass at `e1176c13d` with `TMUX` unset.
  It also failed the full `scripts/ci-local.sh --clean --json` run started
  from the same pane.
- In the trace all six selections with `tmux set mouse on` (Shift-drag) pass;
  the first plain drag after `tmux set mouse off; seq 1 80` produces no
  selection (`copy-selection` never appears), as if the `set mouse off`
  did not reach the test's own tmux server.

## Why it matters

The clean gate's verdict depends on the caller's terminal: a release gate
started from an agent or person working in tmux goes red for a reason that
is not in the product, and the failure looks like a real terminal-selection
regression.

## Not yet known

`terminalHost.env()` builds an explicit environment for the tmux server
without `TMUX`, so where the caller's value reaches the test's shell (the
browser host, the attach client, tmux's `update-environment`, or the gate
scripts) is not established. The Go terminal tests already set `TMUX=`
for their own commands.
