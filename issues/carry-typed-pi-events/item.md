---
created: 2026-10-03
updated: 2026-10-03
type: feature
reporter: jari
status: open
priority: high
lane: client-history
lane_seq: 60
collision: [web/src/components/, web/src/app/]
---

# Carry Pi's typed events and history to the browser

## Purpose

The browser loses much of what Pi records and streams because the host flattens
history into text and forwards only a small part of live updates. Jari decided
on 3 October 2026 that the browser should work from Pi's original typed shapes.
[The event catalogue](../catalog-pi-events/analysis.md) maps those shapes at the
pinned Pi 0.85.1 and identifies the current losses.

## Typed content from Pi to the browser

Carry session entries, ordered message content blocks and live updates through
the daemon, the generated browser contracts and the browser store without
flattening away their meaning. Preserve thinking and redaction, images, tool
arguments and results with their call associations, usage and stop reasons,
local command output, compaction and branch summaries, session markers and
visible extension content.

Distinguish stored entries, streamed changes and lifecycle signals: a tool call,
its progress and its result belong together, and a stream delta is an update to
content rather than a new history row. History and live updates should converge
on the same conversation when a turn ends or the browser reconnects. Pi's native
history remains the durable source; the existing journal carries live updates.

Use the catalogue to account for the supported content and events, explaining
any exclusions. Internal hooks and RPC acknowledgements have different purposes
from conversation content; being listed in the catalogue does not make them
browser display data. Preserve extension visibility and redaction semantics.
Choose browser-visible fields with their contents in mind: provider diagnostics,
raw errors, hook data and arbitrary extension metadata can contain credentials
or internal data, so each of them gets a security review before it is surfaced,
and the result records what was excluded and why. Unknown types need an understandable fallback without exposing unchecked
payloads.

## Integration and presentation

Update the history and event contracts in `contracts/v1/`, their generated
clients, daemon readers and event handling, and browser consumers together.
The project is pre-release, so the flattened format needs no compatibility
layer. Preserve paging, stable entry identity, bounded transfer and the existing
journal recovery behavior. Large images, outputs and summaries need a usable
way to read their content without forcing every history page or live update to
carry it all; the existing separate content reads are the starting point.

Provide a readable presentation using the existing components so the carried
content can be inspected. @design-pi-event-blocks owns the finished block
designs. Incoming extension questions remain visible; answer and cancel controls
stay outside the agreed scope in @build-agent-control. Carrying local command
output likewise does not require adding command controls.

## Acceptance Criteria

- [ ] The catalogue's content and events are accounted for by typed browser data, their internal role or a reasoned exclusion.
- [ ] Synthetic session and live-event tests demonstrate content order, tool associations, visibility, large content and unknown-type handling, including reconciliation with history.
- [ ] The browser presents the supported content from history and live updates where Pi supplies it, while preserving warm conversation switching, paging and reading position.
- [ ] The relevant checks in TESTING.md pass; the result identifies what the synthetic evidence establishes and any remaining live verification.
