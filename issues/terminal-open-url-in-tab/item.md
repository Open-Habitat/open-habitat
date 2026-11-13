---
created: 2026-11-13
updated: 2026-11-13
type: feature
status: done
priority: normal
preparation: ready
lane: terminal
lane_seq: 4
collision: [web/src/components/Terminal.tsx]
closed: 2026-11-13
commits:
- hash: f29e0a0e
  summary: browser terminal lane
---

# Terminal: a program that opens a URL opens it in a tab next to Habitat

## Observed (Jari 13.11.2026)

`gh auth refresh` in the browser terminal tried to open a web browser and
could not find one, although Habitat itself runs in a browser.

## Expected

A program in the terminal that opens a URL (`$BROWSER`, `xdg-open`, `gh`'s
browser step) opens it in a new tab next to Habitat, or at least shows a
clickable card in Habitat if the browser blocks a pop-up. New behaviour:
experimental feature first.
