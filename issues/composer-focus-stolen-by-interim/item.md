---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-27/composer-focus-stolen-by-interim
lane: composer
preparation: ready
closed: 2026-10-27
---

# Interim reply steals focus from the composer while typing

## Description

Jari 2026-10-27: when the agent posts an interim reply (välivastaus) during a turn, keyboard focus leaves the composer the person is typing in. Typing continues elsewhere or is lost. Find what moves focus (live update re-render, scroll-to-latest, jump-latest chip, message mount, aria-live) and fix it so focus and caret stay in the composer during all live updates; desktop and phone.

## Acceptance Criteria

- [ ] Focus and caret stay in the composer while interim replies, tool rows and the final reply arrive; browser test types during a live turn
