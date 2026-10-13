---
created: 2026-10-13
updated: 2026-10-13
type: improvement
status: done
priority: normal
lane: web
lane_seq: 20
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Show Pi session entries as one family and the thread summary in its head

Jari chose on 2026-10-13 (prototype round
`design-system/prototypes/rounds/2026-10-13-merkinnat`) how Pi's session
entries and the thread summary are shown, after reviewing an old
conversation on the test server where "Malli vaihtui · … Kopioi mallin
tunniste" and a centred "Ajattelutaso vaihtui / medium" looked different,
said "changed" for the start state, and "Keskustelun tieto · Checking the
Connection" / "· Quick Ping" blocks and a "Työ · 0 ajatusta · 0 työkalua"
row at the thread's end were confusing.

## Agreed behaviour

Recorded in `design-system/design.md` (Keskustelu, the paragraph before
"Keskustelun sisältö esitetään…") and drawn in
`design-system/drafts/Agentin vuoro.proto.html` (`lib/turn.js` `markerR`,
`lib/app.js` settings chip and details, `lib/live.js` `threadR` head,
`.mrow`/`.set`/`.set-chip` in `lib/language.css`):

- The top bar shows model and thinking level as one chip that opens the
  details popover; the popover has the full model id (copy icon) and the
  thinking level.
- In the stream, the start settings are one quiet row (model and thinking
  level together; entries arriving at different times fill the same row);
  later model or thinking changes and compaction are rows of the same
  family, old → new. Copy is an icon.
- Pi's session-name entries (`session_info`) are not shown.
- A settled thread's summary and duration sit in its head (the PI row, which
  folds the work); no summary row at the thread's end.

## Done when

- History and live match the draft in the same states, light and dark,
  desktop and phone; lab evidence beside the draft here, differences in
  `result.md`; tests cover merging the start entries, change rows, hidden
  session-name entries and the head summary.
