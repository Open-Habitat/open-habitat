---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 5
collision: [web/src/components/composer]
---

# Ctrl+P file picker: odd 'changed first' section, and a query with spaces finds nothing

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the Ctrl+P (⌘P) file picker opens with a 'changed first' section that felt odd, and a query like 'skill tr' (with a space) shows nothing. Space-separated terms should each match (fuzzy, order-insensitive or path-segment aware like VS Code's quick open). Reconsider the changed-files grouping (e.g. a subtle marker in a single ranked list). Tests for multi-term queries.
