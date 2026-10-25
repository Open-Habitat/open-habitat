---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: claude
status: in-progress
priority: normal
lane: unlaned
collision: [internal/daemon]
---

# Daemon native Pi tests hard-code /usr/bin/node

## Description

On Birch (2026-10-25), the full gate failed `internal/daemon` because eight native Pi tests run `/usr/bin/node` directly (`fork/exec /usr/bin/node: no such file or directory`). Birch's conductor account has node only on its PATH (`~/.local/bin/node`); Alder happens to have `/usr/bin/node`. The affected files are `recap_native_linux_test.go`, `pi_rpc_native_linux_test.go`, `notices_native_linux_test.go`, `process_native_linux_test.go`, `title_model_linux_test.go`, `pi_rpc_native_abort_linux_test.go` and `process_resume_native_linux_test.go`.

## Acceptance Criteria

- [ ] The tests resolve node the same way the gate provides it (one shared test helper, for example `exec.LookPath("node")` with a clear failure if it is absent), not through a fixed system path.
- [ ] The tests still pass on Alder, and they pass on a host whose node is only on PATH.
