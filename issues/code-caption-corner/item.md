---
created: 2026-10-15
updated: 2026-10-15
type: improvement
reporter: jari
status: open
priority: normal
lane: web
lane_seq: 39
collision: [web/src/components/]
preparation: ready
---

# Code box caption in the top right corner

Jari, 2026-10-15: the language and line count ("python · 33 riviä") must not
sit on a row below the code or output box; it takes too much room for what it
says. He chose direction Kulmassa of
`design-system/prototypes/rounds/2026-10-15-koodiotsake`: the caption sits
faintly inside the box's top right corner, clear of the side rail and the
scrollbar, and fades out while the pointer or focus is in the box.
`design-system/design.md` (output box paragraph) has the rule and
`design-system/drafts/Agentin vuoro.proto.html` shows it (code in replies,
read/write/edit cards). The prototype code is `prototypes/lib/output.js`
(`xbox`) and the `.out-meta.in-corner` rules in `prototypes/lib/language.css`.

## Acceptance Criteria

- [ ] Reply code, bash output with a language, and read/write/edit cards show
      the caption in the corner; no caption row remains below any box.
- [ ] The caption never covers the rail, the scrollbar or the first line's
      text in a way that hides it (it fades on hover/focus); highlighting state
      ("Korostus odottaa/epäonnistui") stays visible where it is shown today.
- [ ] Lab screenshots light/dark/phone compared with the draft; deviations
      fixed or justified in `result.md`.
