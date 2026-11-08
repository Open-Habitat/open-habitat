---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Queued message briefly shows the agent's reply twice at turn end

## Description

Jari 8.11.2026, test server: he queued a message while the agent was working
(it is sent after the agent stops). At the moment the agent finished and its
reply should appear, the conversation briefly showed the agent's message, then
his queued message, then the agent's message again, before settling to what
the agent actually answered. The transcript must go straight to the final
order without a duplicated agent message. Likely in how the live tail and the
queued message's optimistic row merge with history at turn end
(`web/src/app/ConversationStore*`, the queue in the composer). Reproduce in a
browser spec first.
