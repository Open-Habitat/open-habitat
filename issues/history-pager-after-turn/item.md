---
created: 2026-10-14
updated: 2026-10-14
type: bug
reporter: jari
status: fixed
priority: high
lane: web
lane_seq: 24
collision: [web/]
closed: 2026-10-14
closed_by: claude
---

# Completed turn shows a misplaced forward history pager and stale recap

Jari's live observation on pilot.59 (2026-10-14). Conversation:
`/workspaces/ws_HNLrrcHzMzGyXmfDJyKuYn2N?conversation=pi:4babaa95-7e80-4f0b-ab71-fbe2ef5222a9`
(a private conversation on the test machine; reproduce it in the lab).

When an agent turn completed in an open browser conversation:

1. A "Lataa seuraava historiasivu" (load next history page) button appeared at the **bottom** of the conversation. It spanned far too wide and started much further left than the rest of the content.
2. When the Tilannekatsaus (recap) arrived, it was placed **below** that button.
3. The button stayed there. Jari did not press it.
4. The single-line composer rendered as **two rows**, probably because of the extra control.

Expected behaviour:
- Forward history paging must not show a pager after the live tail once the conversation is already at its newest entry. When a pager is genuinely needed, it uses the conversation column's width and alignment. Find out why a completed live turn makes the history view believe there is a newer page (live/native merge or cursor state), and fix that cause rather than hiding the button.
- The composer stays one line when empty.

Also in scope (same code path): **the recap closes when the user sends a message.** Once a new message is sent, the Tilannekatsaus card is out of date. Dismiss it on send. The next recap replaces it when it arrives.

## Acceptance Criteria

- [ ] A lab journey reproduces the completed-turn state (live turn ends, native history catches up) and shows no forward pager. The recap sits directly above the composer.
- [ ] Any pager that is shown has the conversation column's width and left edge (element-rectangle check).
- [ ] The empty composer is one line after a completed turn.
- [ ] Sending a message hides the current recap (browser test).
