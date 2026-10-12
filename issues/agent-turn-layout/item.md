---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: open
priority: normal
lane: web
lane_seq: 5
collision: [web/]
preparation: ready
---

# Agent turn repeats its author and hides short thinking

Jari observed this in a Pi conversation using GPT-5.5 on pilot.22 on
2026-10-12. The native-session inspection recorded in this report found
only short, single-line thinking summaries (31–51 characters), such as
`**Planning status table parsing with Python**`. Opening "Ajattelu" exposed
that one line in a code-styled box with visible Markdown asterisks.
"PI · GPT-5.5" also repeated above thinking, tool calls and messages,
adding noise to the agent's work.

The reader should be able to follow the work and recognize the actual reply
without opening a disclosure just to read a short summary. Short single-line
thinking belongs directly on the "Ajattelu" row with Markdown rendered;
multi-line thinking retains an expandable form. This concerns the readable
text supplied by Pi, not encrypted thinking data.

The agent's reply gets a bubble, like the "Sinä" message, giving its copy
action a natural home. The author/model label appears at most once per reply
rather than above each work block. User messages keep their author treatment,
and model information remains attached to the assistant message it describes.

The [conversation draft](../../design-system/drafts/Pi-keskustelun%20lohkot.dc.html)
provides the surrounding visual language. Its bubble-free reply and collapsed
thinking examples predate the changes requested here. The shared icon rules
are in [design.md](../../design-system/design.md).

Lab validation on desktop and phone should show that short summaries are
readable directly, longer thinking remains accessible, and replies and their
copy actions are easy to find even in a turn with many tool calls.
