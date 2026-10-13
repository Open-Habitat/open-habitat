---
created: 2026-10-13
updated: 2026-10-13
type: improvement
status: in-progress
priority: normal
lane: web
lane_seq: 22
collision: [web/]
---

# One grouped output box for bash output and reply code

Jari chose on 2026-10-13 (prototype rounds
`design-system/prototypes/rounds/2026-10-13-vastausteksti`, direction
Ikkuna, and `rounds/2026-10-13-laatikko`, direction Ryhmät) one output box
for bash output and for code blocks in replies, after finding that the
reply code block looked wrong (bold "Koodi" band, separate "Kopioi koodi"
row), that long lines needed much sideways scrolling, that the rail's
buttons were hard to tell apart, and that "Alkuun" stayed highlighted
after he scrolled away.

## Agreed behaviour

Recorded in `design-system/design.md` (Keskustelu, bash-card paragraph) and
drawn in `design-system/drafts/Agentin vuoro.proto.html`; the source is
`xbox()` and its handlers in `design-system/prototypes/lib/output.js`,
`codeBox()` for reply code, `toolBody()` in `lib/pieces.js` for history bash
cards, and the "Output box (chosen 13.10.2026, Ryhmät)" rules plus the
"Reply structure" and "Code in a reply" rules in `lib/language.css`.

- Reply code (fenced Markdown) uses the bash output box: alku ja loppu with
  the dashed gap row, language and line count under the box. Headings,
  ordered lists, tables and quotes follow the draft's reply structure.
- The rail is grouped: copy · view selector (alku ja loppu, vieritettävä
  ikkuna, kaikki rivit) · Alkuun/Loppuun only in the scroll view · wrap and
  own window. Only the view is a pressed state; Alkuun/Loppuun are actions
  disabled when the box already is at that end, updated on every scroll.
- Long lines do not wrap by default; an inner edge shadow shows the line goes
  on; head and tail of alku ja loppu scroll sideways together; wrapping hangs
  the continuation.
- Running output starts in the scroll view and follows the end until the
  reader scrolls up.

## Done when

- Bash output (live and history) and reply code match the draft in the same
  states, light and dark, desktop and phone; lab evidence beside the draft
  here; tests cover the view state, jump disabling after scrolling, wrap and
  copy of the full text.

## Acceptance Criteria

- [x] Shared output box, reply structure, grouped rail and command copy work in live and saved conversations.
- [x] Scroll and wrap behaviour, copy, synthetic lab captures and a11y/browser checks are recorded in `result.md`.
