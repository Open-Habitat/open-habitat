---
created: 2026-11-28
updated: 2026-11-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/wake-quiet
lane: unlaned
preparation: ready
---

# Setting a wake moves the conversation to Hiljaiset even when the turn asks the person something

## Description

Jari 28.11.2026: when an agent sets a wake in a turn that also asks the
person something, the conversation lands in *Hiljaiset* and the question is
missed. Several of his main-loop conversations did this.

Cause (verified): `wake create` moves the conversation to `quiet` itself
(`internal/daemon/scheduled_wake_linux.go`, after creating a wake:
"Waiting for a wake is the reason Hiljaiset needs; one command, so the agent
cannot leave a waiting conversation in Sinun vuorosi"). The agent guide says
the same ("The conversation waits in Hiljaiset"). A turn that both asks and
sets a wake therefore hides its question.

Fix: setting a wake does not choose the rail section. The ordinary rule
applies: a reply stays in Sinun vuorosi; an agent whose turn only waits for
its wake and asks nothing sets `quiet` itself (`section update --current
--section quiet`), as it sets `running` for work in flight. Update the guide,
the agent skill and the wake command's help.
