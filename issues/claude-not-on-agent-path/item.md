---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet run 01m64kr0dj2mqbxncdtde7vkb1 (fleetrepo test-server env gaps)
source_ref: taskfleet:01m64kr0dj2mqbxncdtde7vkb1/claude-not-on-agent-path
originating_run: 01m64kr0dj2mqbxncdtde7vkb1
originating_run_kind: spinoff
---

# Claude Code workers need claude on the agent PATH; the runtime's bundled Claude Code is not exposed

## Description

## Observation

On the Open Habitat test server (29.10., pilot.511) `taskfleet run create --harness claude` failed with `worker_handshake_identity_mismatch` because `claude` was not on the Habitat agent's PATH (`@test-server-claude-harness-missing`).

The test server's own installation has been fixed in Fleetrepo: `/usr/local/bin/claude` now wraps the selected runtime's Claude Code. Fleetrepo run `01m64kr0dj2mqbxncdtde7vkb1`, `infra/open-habitat-test/GUEST-AGENT-ENVIRONMENT.md`. That only covers the test VM. The cause is general.

## Product cause

The product ships Claude Code in its core runtime (`node_modules/@anthropic-ai/claude-agent-sdk-linux-<cpu>/claude`) and runs it for the Claude sign-in (`internal/daemon/claude_login_linux.go`, `claudeLogin.binary()`). The agent PATH (`internal/daemon/agent_path_linux.go`) is `~/.local/bin:~/.cargo/bin:/usr/local/bin:/usr/bin:/bin:<release bin>`, and nothing places that binary on it. Host apply does not link it anywhere either. The product offers Claude Code workers (the worker view, `readClaudeWorker`), and Taskfleet launches the `claude` harness from PATH. So on a product installation a Claude Code worker works only if the person has installed Claude Code themselves into one of those directories. Birch works because Fleetrepo dotfiles put `claude` in `~/.local/bin`. A customer installation such as northwind or contoso has no such step.

## Expected

An agent on any installation that has a Claude sign-in finds `claude` on its PATH, and it is the same Claude Code binary and credential store that the sign-in uses. One option is a `claude` entry in the release bin or the core runtime's bin, resolved from the selected runtime.
