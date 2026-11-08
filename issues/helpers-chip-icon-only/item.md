---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
---

# Helpers chip shows only its icon, not the word Avustajat

## Description

Jari 8.11.2026, test server: the helpers chip beside the Workers pill should
not read "Avustajat"; its icon is enough. Jari asked for this exact change, so
no prototype. The chip keeps an accessible name and tooltip in both languages
and its count/marks, and its Explain-mode card (added by
`helpers-panel-explainer-text`) describes the icon.

## Acceptance Criteria

- [ ] Chip shows the icon (and count/marks) without the word, fi and en, 1440 and 390; accessible name kept.
- [ ] Touched specs green.
