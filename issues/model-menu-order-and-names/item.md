---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: conversation-header
lane_seq: 1
collision: [web/src/components/conversation-header]
closed: 2026-10-23
---

# Model menu: proper names and most capable first

## Description

Jari 2026-10-23: the model menu in the conversation header lists Opus, Fable (without a proper display name), Sonnet, Haiku — wrong order: Fable is the most capable. The thinking-level control orders levels from low (left) to high (right), while the model list puts the most capable first, which feels inconsistent.

Conductor's design decision (state it in the result): vertical lists order by capability **descending, most capable at the top** (Fable 5.1, Opus 5.5, Sonnet 5, Haiku 4.5); horizontal scales (thinking level) go **low → high, left to right**, like a slider. Show proper display names from the provider's model metadata (e.g. "Fable 5.1"), never raw ids, and order by an explicit capability rank from that metadata or a small product table, not alphabetically or by API order.

## Acceptance Criteria

- [x] Menu shows Fable 5.1, Opus 5.5, Sonnet 5, Haiku 4.5 in that order with proper names; header chip uses the same name; thinking scale unchanged low→high; browser test.
