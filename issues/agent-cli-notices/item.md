---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: open
priority: normal
related: ['@agent-cli-route']
lane: agent-cli
lane_seq: 3
collision: [agent-cli]
---

# Agent CLI slice 2: timestamped conversation notices from the agent

_Source: chat:agent-cli-2026-10-21_

Second slice of ADR 0027 (`docs/decisions/adr-0027-agent-cli-route.md`); see [implementation notes](../agent-cli/adr-0027-notes.md), section B and slice 2. Jari's decision 3 (2026-10-21, [agent-cli](../agent-cli/item.md#decisions)): the first notice type is a basic notice attached to a conversation with a visible timestamp; acknowledgement semantics are open (a close control is fine); implement openly and shape it from how agents use it.

Deliver: a notice contract in `contracts/v1` with generated bindings; `agent notice create --conversation C` and `agent notice list`; notices stored as native conversation entries with agent origin and timestamp and delivered over the existing event stream; a visible place in the browser conversation; an honest outcome when the native write fails (EDQUOT), with a live nonpersistent warning to an open browser where possible. No notice database, no approval system.

Done when: an agent in a native Pi session raises a notice that the person sees in the browser with its origin and time; a full-quota notice reaches an open browser and the CLI reports that it was not persisted; contract and browser tests cover both.
