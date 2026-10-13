---
created: 2026-10-13
updated: 2026-10-13
type: bug
reporter: jari
status: fixed
priority: normal
related: ['@conversation-actions-layout', '@bash-tool-card']
preparation: ready
lane: web
lane_seq: 9
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Bash tool card spacing and marks differ from the draft

Jari reviewed a finished `bash` tool use in pilot.25 on 2026-10-13 and found
the card's spacing and marks off from the agreed draft
(`design-system/drafts/Agentin vuoro.proto.html`, built from
`design-system/prototypes/lib/language.css` and `output.js`):

- The gap between the header row ("bash") and the command box is larger than
  in the draft. The draft's body has 12px padding under a header of min-height
  34px with 6px/12px padding; production adds the disclosure panel padding on
  top of the generic disclosure spacing.
- "valmis" shows a dot; the draft shows the check mark before "valmis"
  (`okMark()`), as every finished tool row does.
- The draft has a hairline (`border-top: 1px solid var(--ah-line-soft)`)
  between the header row and the body; production has none.
- The "11 riviä välistä · Näytä kaikki" row between the head and the tail
  has too much empty space above and below it. In the draft it is a thin
  row (`padding: 4px 12px`, 12px text) joining the two parts into one box;
  production renders it through the `Button` primitive, whose own size rules
  likely outweigh `.ah-bash-gap`'s `min-height: 0` and padding.
- The "21 riviä" line under the output sits too close to the box above and
  too far left. In the draft the meta line is 6px below the box (`.out` gap)
  and should start where the box's text starts.

Also found while comparing: the draft's header shows the command after the
tool name (`bash  python3 -m pytest tests/ -v`, muted mono); production shows
only "bash" because `PiToolUse` passes no `targetText`.

The fix touches `ToolRow` in `web/src/components/Conversation.tsx`,
`PiBlocks.tsx`, `BashToolCard.tsx`, `components.css` and the `PiToolUse`
callers in `app/HistoryView.tsx` and `app/BrowserConversation.tsx`, the same
files `conversation-actions-layout` changes, so it follows that work. Verify
with the lab against the draft at desktop and phone width, light and dark.
