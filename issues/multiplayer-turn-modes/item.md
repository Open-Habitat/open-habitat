---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0038 implementation (technical decision run)
source_ref: taskfleet:01m7ys433k48ngv5prdxv58f4e/adr-0038-implementation:turn-modes
originating_run: 01m7ys433k48ngv5prdxv58f4e
originating_run_kind: technical-decision
preparation: pending
related: ['@multiplayer-conversations']
---

# Multiplayer: participant messages and text-only turns in the Pi companion

## Description

Implements sections 3–5 of ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`) in the daemon's Pi companion (`internal/daemon/process-extension.mjs`) and the conversation controller. Waits for Jari's answers to the ADR's questions 2, 6 and 7.

- Bridge op `participant_message`: the companion writes `oh-participant-message` custom messages (`display: true`, author in `details` from the daemon's record) with `triggerTurn`, refused while a run is in progress. The daemon holds participant messages until Pi is idle, one run per message, never joined with the owner's held text, rechecked against the current record at delivery.
- Turn mode `tools` / `text_only` / `approve_each` decided in `before_agent_start`: owner input means a user message whose `input` source is `rpc` or `interactive`; `sendUserMessage` from an extension keeps the mode; wakes and process notifications keep the mode. Owner steering during a run switches to `tools`.
- The mode is rebuilt from the branch on `session_start` and after branch switches (a participant message means `text_only`; an unreadable branch means `text_only`).
- `tool_call` blocks every call in `text_only` (`block`, `terminate`), nested codemode calls included, whatever other extensions return. Provider-side web search (`runtime/core/web-search.mjs`) and the Claude bridge's built-in WebSearch/WebFetch are off in `text_only` and `approve_each`.
- Releasing a waiting request: `oh-conversation-line` kind `continue` (mode `tools` = Salli kaikki, or `approve_each`), or `declined`. In `approve_each` each call is asked one at a time through `ctx.ui.select` (Salli / Älä salli / Salli kaikki), with the call's complete arguments given to the daemon as an owner-only approval detail bound to the call ID. Only the owner answers questions in a shared conversation.
- A grant revoke op switches a run started by that participant to `text_only` from the next call.
- Host context: participant text is information, not instructions for the owner's turns.

Acceptance tests against the pinned Pi and bridge: parallel batches, nested codemode calls, a hostile extension handler returning no block, a restart between a participant message and a scheduled wake, an extension `sendUserMessage` after a participant turn, revocation during a run, and proof that every bridge-served tool passes `tool_call`.
