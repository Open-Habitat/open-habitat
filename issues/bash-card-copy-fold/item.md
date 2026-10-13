---
created: 2026-10-13
updated: 2026-10-13
type: improvement
status: in-progress
priority: normal
lane: web
lane_seq: 12
collision: [web/]
---

# Bash card: copy in the output rail, closed in loaded history, no code ligatures

Jari decided three changes to the bash tool card on 2026-10-13 while
prototyping the reply text. They are recorded in `design-system/design.md`
(the bash-card paragraph of the Keskustelu section) and drawn in
`design-system/drafts/Agentin vuoro.proto.html`.

## What changes

- **Copy in the output rail.** The output box's side rail starts with a copy
  button that copies the whole output, and it is there for short output too
  (one or two lines), where the rail otherwise has no buttons. The draft's
  `box()` in `design-system/prototypes/lib/output.js` and `.out-rail
  .out-copy` in `lib/language.css` show placement and spacing.
- **Closed when a conversation is loaded.** When a conversation is opened and
  its history has to be loaded, every bash card in it starts closed. Cards
  that arrive while the person is watching start open as now. Switching back
  to a conversation that was just being viewed keeps the open/closed state the
  person left it in, so the rule is about loaded history, not about every
  render. Today `PiToolUse` opens every non-forming bash card
  (`web/src/components/PiBlocks.tsx`).
- **No ligatures in code.** JetBrains Mono draws `>=`, `<=`, `==`, `::`, `|-`
  as single glyphs, so the shown code differs from what is copied. Turn
  ligatures off for every monospace code and output surface (command, output,
  Markdown code, inline code). A `font` shorthand resets
  `font-variant-ligatures`, so the rule must win over later shorthands.

## Done when

- The three behaviours work in history and live, light and dark, desktop and
  phone widths, and the synthetic lab captures show them next to the draft in
  the same states (copy rail on short and long output, a loaded conversation
  with closed cards, a live card open, code without ligatures).
- Tests cover the initial-open rule for loaded versus live cards and the copy
  action's text.
