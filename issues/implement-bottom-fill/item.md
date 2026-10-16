---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# New conversation fills from the bottom (Alhaalta)

Jari chose **Alhaalta** (2026-10-16) in round `design-system/prototypes/rounds/2026-10-16-tayttosuunta/` (`issues/proto-composer-strip/result.md`): a new conversation's thread starts at the bottom, next to the composer, and grows upwards; a tall thread stays scrollable from its first line (`margin-top: auto` on the thread wrapper, not `justify-content: flex-end`), and the empty-conversation text moves down. Move the rule into the prototype library and `design.md` too, then implement it in production, keeping the follow-latest rule.

## Acceptance Criteria
- [ ] Production matches the round's Alhaalta direction in empty, first-message, long-reply and recap states, desktop and phone (paired screenshots, browser test that a tall thread scrolls to its first line).
