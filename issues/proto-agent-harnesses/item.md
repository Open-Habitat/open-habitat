---
created: 2026-10-15
updated: 2026-10-16
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

## Decisions

### 2026-10-16T05:57:30Z · @jari

Jari 2026-10-16: no menu on the + button; it opens a conversation with the default agent. The field selector (Kentän valitsin) is fine. The Pi extension alternative is close to the field selector in the UI, and it is what we really want: only Pi underneath if at all possible. Claude Code as a separate harness may be needed if a Pi extension does not work properly with an Anthropic subscription. Codex is not needed, probably ever. If a separate harness is adopted, its permission prompts must be shown in the browser. The default model and default thinking level deserve their own larger settings item (see implement-model-choice / implement-settings-osiot). ADR 0016 goes through /rethink-document before Jari reviews it.

### 2026-10-16T06:00:15Z · @jari

Jari 2026-10-16: 'works properly' means technical functioning; the providers' terms are left to Jari's own judgment. The Anthropic SDK-based Pi extension works in practice.
