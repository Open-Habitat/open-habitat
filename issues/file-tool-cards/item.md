---
created: 2026-10-13
updated: 2026-10-13
type: improvement
status: in-progress
priority: normal
lane: web
lane_seq: 23
collision: [web/]
---

# File tool cards: stats, read/write in the output box, edit as a line diff with word marks

Jari chose on 2026-10-13 (prototype round
`design-system/prototypes/rounds/2026-10-13-tiedostot`, direction Rivit with
VS Code-style word marks) how the file tools are shown; production today
shows the allowed arguments and the raw result, and the edit diff was
deferred. He also asked for a copy button beside the bash command.

## Agreed behaviour

Recorded in `design-system/design.md` (Keskustelu, the paragraph on
grouping and file tools) and drawn in
`design-system/drafts/Agentin vuoro.proto.html`; source `editDiff()`,
`fileStat()`, `fileBody()`, `cmdCopy()` in
`design-system/prototypes/lib/output.js`, `toolBody()`/`toolRow()` in
`lib/pieces.js`, and the "File tools" and `.cmd-row` rules in
`lib/language.css`.

- The closed row says how much: read "N riviä", write "uusi · N riviä",
  edit "+a −d" (green/red).
- read and write open into the output box (language from the extension,
  grouped rail, copy).
- edit shows a line diff of Pi's old and new text: removed lines on a red
  ground, added on a green one, and within a paired changed line the
  differing words in a stronger tone; screen readers hear "poistettu" /
  "lisätty". Copy copies the new text. If Pi's edit result already carries a
  diff, prefer the native one and record the choice.
- The bash command has a copy button on its right, aligned with the output
  rail; it copies the whole command.

## Done when

- History and live cards match the draft in the same states, light and dark,
  desktop and phone; tests cover the stats, the diff pairing and word marks,
  and both copy actions; lab evidence here, differences in `result.md`.
