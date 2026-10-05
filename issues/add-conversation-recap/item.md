---
created: 2026-09-20
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 10
collision: [docs/, design-system/]
preparation: pending
---

# Evaluate a user-requested conversation recap

Help someone returning to a long conversation understand where the work stands
and what they might do next. Use observed MVP experience to judge whether a
recap helps. This issue holds the post-MVP design work for
[L7](../native-agent-host-architecture/ui-design-later.md); implementation is a
separate decision with Jari after reviewing the design.

The starting point is a user-requested, short card separate from the conversation
history. Automatic recap is a later possibility once the manual experience
proves useful. The user needs to understand when generation is underway or has
failed, how old the recap is and whether the conversation has moved on since it
was made. A suggested next step, linked to its target where applicable, helps
them resume work; the choice to act remains theirs.

Pi's TUI `/recap` extension is a reference, not evidence of browser support.
Establish what the native component exposes and describe any missing integration,
including model-call cost and separation from the active conversation's model
context. The recap helps the user catch up while native history remains the
source of truth. The [architecture](../../docs/architecture/index.md) explains
native ownership of history, configuration and subprocesses and the HTTP/SSE
boundary; a recap does not need a parallel store or a new owner of native work.

The result belongs in this issue directory: a concrete interaction design,
its review with Jari, and integration findings sufficient to decide whether to
implement it. Ground the recommendation in observed use, including if that
evidence does not justify a recap. The earlier
[conversation design](../native-agent-host-architecture/ui-design-conversation.md)
and [design package](../native-agent-host-architecture/ui-design-package.md)
provide UI context, not a settled recap design.
