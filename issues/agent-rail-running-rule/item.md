---
created: 2026-11-23
updated: 2026-11-23
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m84b2b75mg7d827qtzmkf485/rail-section-rule
originating_run: 01m84b2b75mg7d827qtzmkf485
originating_run_kind: spinoff
closed: 2026-11-23
---

# Agent guide: rail section rule fails when work is in flight

## Description

A conductor agent ended several turns with workers running and a reply that
asked nothing of the person, but never set its conversation to `running`, so
the conversation sat in *Sinun vuorosi* although nothing was the person's turn.

The rail rule in the host guide (`internal/daemon/host-context.md`) and the
agent skill (`internal/cli/agent/SKILL.md`) causes this:

- it is phrased as permission ("You can place it yourself"), and `yours` says
  "you seldom need to say it", so the paragraph reads as optional;
- it says "as the last step of your turn, once you know what the reply says",
  but the final reply is the end of the turn, so the command has to run before
  the final message;
- nothing ties it to starting a worker or a `taskfleet run wait` and then
  ending the turn, which is where it matters.

Done when the guide states it as the rule for that case (last tool call before
the final message), the Worktree agents and Helpers sections mention it where
they start `taskfleet run wait`, and the agent skill agrees.
