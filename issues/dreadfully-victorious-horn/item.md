---
created: 2026-11-08
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6xa50g3dz9s1ewkn7nwndj3/observed:agent-path-test-installed-host
originating_run: 01m6xa50g3dz9s1ewkn7nwndj3
originating_run_kind: spinoff
closed: 2026-11-14
---

# Agent PATH test fails on hosts with an installed release (agent-bin missing from expectation)

## Description

`TestAgentCommandPathIsPerHomeAndInherited` (internal/daemon/agent_path_linux_test.go) fails on Birch, where an Open Habitat release is installed.

Observed 2026-11-08 in worktree wt/wkn7nwndj3-r68-rbrowser (`go test ./internal/daemon`), also with `PATH=/home/maintainer/.local/bin:/usr/local/bin:/usr/bin:/bin`: the Pi child's observed PATH ends with `…/payloads/core/runtime/node_modules/@anthropic-ai/claude-agent-sdk-linux-arm64:…/payloads/core/runtime/agent-bin`, but the test's expected PATH stops after the Claude SDK directory. The selected runtime comes from the host's installed selector (`core.LoadSharedPiRuntime`), whose runtime ships `agent-bin`; the test builds `want` from `agentClaudeCodeDir` only and does not add the runtime's `agent-bin`, which production `agentPath` appends.

Impact: every worker on an installed developer host (Birch) sees a red daemon package and has to tell this apart from its own change. The worktree's change did not touch agent PATH code.

Direction: build the expected PATH with the same rule production uses for the selected runtime's `agent-bin`, or make the test ignore the host's installed selector.

## Resolution

### 2026-11-14T07:30:02Z · @issuectl

The test was updated in 3535ad15 the same day; the clean gate passes on a host with an installed release (13.11.2026).
