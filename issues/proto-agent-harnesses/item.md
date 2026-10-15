---
created: 2026-10-15
updated: 2026-10-15
type: task
reporter: jari
status: done
priority: high
lane: proto-agents
lane_seq: 1
blocked_by: ['@claude-subscription-path']
collision: [design-system/prototypes/rounds/proto-agent-harnesses]
preparation: ready
closed: 2026-10-15
---

# Prototype: Claude and Codex next to Pi

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

Jari: a big one, Claude through a subscription, either via a Pi extension on the Claude SDK or by supporting the Claude Code and Codex harnesses. `claude-subscription-path` produces the research and a proposed ADR (run `01m508qzpsz0smt1pbv9rcyw8c`); prototype the recommended path and show the alternative where the UI differs: choosing the agent for a new conversation, signing in to each provider, how a conversation shows which agent and model it runs, and what is unavailable for a given agent.

## Acceptance Criteria
- [ ] The architecture sketch is the proposed ADR from the research, updated if the prototype changes it.
- [ ] Round verified with check.mjs; `result.md` per the prototype worker rules.
