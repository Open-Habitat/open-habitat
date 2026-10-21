---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: open
priority: normal
related: ['@agent-cli-notices']
lane: agent-cli
lane_seq: 4
collision: [agent-cli]
preparation: ready
---

# Agent CLI slice 3: the rest of the personal surface in bounded batches

_Source: chat:agent-cli-2026-10-21_

Third slice of ADR 0027 (`docs/decisions/adr-0027-agent-cli-route.md`); see [implementation notes](../agent-cli/adr-0027-notes.md), section B and slice 3, and the inventory in [research](../agent-cli/research.md). Jari's decisions 2 and 4 apply: the agent may steer other own conversations and change global defaults, the browser-confirmation set is empty, and ordering is the implementer's call.

Deliver, in batches that each land independently: conversation control including other own conversations (messages, steer, follow-up, queue, resume, interrupt, stop, archive, close, titles, recaps); global model defaults and Git identity; workspace, repository, clone, worktree and Trash operations; integrations and credential configuration with secrets from stdin or file and redacted replies; history, receipts, processes, attachments and local-file requests. Existing ownership, one-writer, observation-token and typed-delete checks apply unchanged; native `git`, `gh`, `tmux` and `taskfleet` are not wrapped. No gateway or broker operations.

Done when: every daemon-owned inventory row in the research is either a working `agent` command or marked native with its reason; the `agent` skill documents the workflows; the canon review passes for the whole agent surface.

## Partial delivery

The global-defaults batch adds `agent model list/update`; Git identity stays native `git config --global`, with its reason in the bundled skill. [Results and remaining batches](result.md) track the partial delivery. Conversation control, workspace/clone/worktree/Trash, integrations/credentials and history/processes/attachments/local files remain; keep this issue open.
