---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m6xa55e9dqhwybytaqf37hxb/test-failure:core-agent-path
originating_run: 01m6xa55e9dqhwybytaqf37hxb
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Daemon PATH test omits installed core agent tools

## Description

## Observed failure

On Birch, `go test ./internal/daemon` fails in `TestAgentCommandPathIsPerHomeAndInherited` at `internal/daemon/agent_path_linux_test.go:91` when the installed core runtime includes `runtime/agent-bin`. The actual child PATH ends with that trusted tools directory, but the test constructs its expected PATH only through the optional Claude Code directory.

Reproduced with `go test ./internal/daemon -run '^TestAgentCommandPathIsPerHomeAndInherited$' -count=1` in a clean archive of commit `13a31034056cc89e25d268a7f5d66ceeda053d7d`, without the attachment-count edits. The ordinary package check fails on the same assertion after Python schema dependencies are installed.

## Impact and proposed direction

Installed developer hosts with the bundled agent tools cannot get a green daemon package check, obscuring genuine regressions. Update the test's expected PATH to account for the trusted core tools directory using the same installed-runtime observation as its existing Claude Code expectation; retain the assertions that the other synthetic home never reaches PATH. Production path construction deliberately includes these tools; this is an outdated expected value, not a cross-user isolation defect.
