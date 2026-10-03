---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@unify-ui-primitives']
lane: post-mvp-design
lane_seq: 60
collision: [docs/, design-system/]
related: ['@consistent-control-feedback', '@align-navigation-design', '@design-control-states', '@apply-control-state-design']
---

# Design a consistent language for agent states

## Purpose

Help a person understand what an agent is doing and whether it needs attention,
wherever it appears. Jari's sidebar observations on 2 October 2026 raised a
usability question: which states matter, what they mean, and how the same meaning
is recognised across the agent list, sidebar and conversation.

## State meaning

Describe the user-facing states from current agent behavior, the facts available
from the host and observations of use. Process presence, activity, a request for
the person's attention and browser control answer different questions. A running
process alone does not establish that the agent is working, and losing contact
with it does not establish that it has stopped. Explain how the presentation
handles missing or stale information alongside the states it can establish.

For each proposed state, describe what it tells the person, which facts support
it and what the person can do about it. Identify missing information where a
useful distinction cannot yet be made. The current contracts and presentation
code are evidence for what is available; existing labels and symbols do not
define the intended meaning.

## Shared presentation and delivery

Prepare the meanings and representative examples for the agent-state chapter
of @design-control-states. The designer handles agent states in the same
package as the shared controls' interaction states so their presentation forms
a coherent whole. The designer develops one recognisable visual language for the agent
list, sidebar and conversation, including compact presentations. Text, symbols,
color and motion can work together; meaning remains available without relying
on color or animation alone. The existing dot treatments are reference material;
The state set and visual form are outcomes of this design work.

The result is a recommendation connecting each state to known facts and showing
how the designer's presentation works across views. @design-control-states owns
the package and design round. @apply-control-state-design implements the agreed
presentation through the shared `agentPresentation` mapping from host facts,
using the foundation from @unify-ui-primitives. Coordinate the examples with
@align-navigation-design and the conversation views so they use the same meanings.
