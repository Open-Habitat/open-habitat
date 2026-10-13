---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: open
priority: normal
lane: web
lane_seq: 14
blocked_by: ['@bash-card-copy-fold']
collision: [web/]
---

# Composer: one-line field text sits high instead of centred

Jari reported on 2026-10-13 from the test server (screenshot of the empty
composer, desktop): the one-line field is taller than its line and the
placeholder "Viesti Pi:lle" sits near the top edge instead of centred, with
the Send button centred beside it.

## Agreed behaviour

At rest the composer is one line high and its text, typed or placeholder, is
vertically centred in the field and aligned with the Send button, as in
`design-system/drafts/Agentin vuoro.proto.html` (`lib/composer.css`:
`.cbox textarea` with `min-height: 44px`, `padding: 11px 14px`,
`line-height: 1.45`). The field still grows with the text to about twelve
lines (`design-system/design.md`, composer paragraph). Production is in
`web/src/components/Conversation.tsx` / `AgentInteractionControls.tsx` and
`components.css`.

## Done when

- Empty, one-line and multi-line states match the draft at desktop and phone
  width, light and dark; lab captures beside the draft in
  `issues/composer-text-centering/` with remaining differences explained in
  `result.md`.
