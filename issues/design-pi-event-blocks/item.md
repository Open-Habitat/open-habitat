---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@design-control-states']
blocked_by: ['@design-control-states']
lane: pi-event-design
lane_seq: 10
---

# Design every Pi event block

## Purpose

The browser should make Pi's conversation content understandable without losing
its meaning. Jari decided that the designer designs every visible block and its
relevant states, using Pi's original typed shapes as the starting point. Today's
flattened history and ad hoc presentations do not define the design.

## Design input

Use [the Pi event catalogue](../catalog-pi-events/analysis.md) and its linked
type and tool references to inventory the visible content, its meaning and its
states. @carry-typed-pi-events owns delivery to the browser and a readable initial
presentation; this issue owns the finished designs.

The catalogue covers prompts, assistant responses, thinking, tool calls and
results, local command output, summaries, session markers, visible extension
content, incoming questions, errors and recovery, queues and activity. These
are related kinds of information, not a prescribed set of cards. Live updates
change content or activity already on screen. A tool call, its progress and its
result should read as one coherent tool use, while ordered mixed content keeps
its meaning. The designer chooses grouping, placement and expansion from those
relationships.

Readable thinking and user-facing content remain available. Encrypted payloads
and internal metadata do not become messages; omitting unreadable encrypted
thinking needs no warning card. Design a quiet fallback for genuinely unknown
content, with useful details where available rather than an unchecked JSON dump.
Hidden extension content stays hidden. History and live content use the same
presentation principles.

Incoming questions are shown under the agreed scope in @build-agent-control;
Pi-specific answer and cancel controls remain outside it. Likewise, showing
local commands or branch summaries does not add command execution or branch
navigation controls. Reuse the control states and agent-state presentation from
@design-control-states so conversation content fits the rest of the UI.

## Design round and delivery

Prepare the package with the repository's `design-package` skill. Explain each
block through its typed data, meaning and realistic synthetic or anonymised
examples. Include the states that matter to that content: streaming and settled,
short and long, success and error, truncation and access to available full content.
Show the current components and tokens, with desktop and phone examples in both
themes. Existing presentations are context for the designer, not presumed approved
designs.

Deliver the package to Jari and keep its brief in this issue. Jari conducts the
design round. Reconcile the returned handoff with `design-system/design.md` and
`design-system/drafts/` so there is one current design to implement.

File the follow-up rendering work from that handoff. It implements the designs
in shared production components and their catalog examples, with synthetic lab
comparisons as described in AGENTS-WORKFLOW.md. Preserve the block-library goal
from @raw-thinking-history-blocks: a reader can find a block's meaning, handler,
design and catalog example, and see what coverage is missing. New block types
follow the same designer-led approach.

## Acceptance Criteria

- [ ] The delivered package accounts for the catalogue's visible content and relevant states from Pi's typed data, including the unknown-content fallback; its brief is kept in this issue.
- [ ] The returned designs cover every visible block and its relevant states on desktop and phone in both themes, using the shared control and agent-state design.
- [ ] The handoff is incorporated into the current design sources, and follow-up work covers production rendering, discoverable block-library examples and comparison with the designs.
