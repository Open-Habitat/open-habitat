---
created: 2026-10-02
updated: 2026-10-14
type: improvement
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m3xj0rdnnfgsm45yabgh5bpq/follow-up:conversation-retention
originating_run: 01m3xj0rdnnfgsm45yabgh5bpq
originating_run_kind: spinoff
lane: post-mvp-design
preparation: pending
---

# Tune browser conversation retention and eviction after measurements

## Purpose

Keep returning to recent conversations fast without retaining excessive browser
memory during long sessions. The current conversation store keeps about 50
recently viewed conversation windows per tab and evicts whole windows. It has
no byte limit or separate release of older pages, so the amount retained depends
on conversation length and tool-output size.

## Approach

Measure browser heap use and the delay from selecting a conversation to seeing
its content with long histories, large tool outputs and several conversations
in use. Use those results to judge whether the current policy needs changing.
Adjustable conversation limits, byte limits and release of older pages are
options to evaluate, not requirements to implement all three.

Favour a simple policy that preserves immediate switching to retained content.
History remains in native Pi files; browser memory holds reloadable, contiguous
windows into it. If content is released, scrolling back should load it again
and restore the reading position where that entry remains available.

## Expected result

Record the measured memory use and switching performance, the policy chosen
from that evidence, and how any limits can be adjusted. Demonstrate the effect
on returning to recent conversations and reading older content after eviction.
This is a later improvement to the existing store, not a prerequisite for it.

The agreed baseline and data ownership are described in
[conversation data-flow](../../docs/conversation-data-flow.md).

## Comments

### 2026-10-05T10:14:25Z · @intake

Deferred: Later optimization: measure realistic long conversation memory and switching latency first; revisit only if those observations justify a changed retention policy.
