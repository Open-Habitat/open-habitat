---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Readable worker conversation drops the 'Pääte · vain luku' row

## Description

Jari 8.11.2026, test server, a helper's (Avustaja) conversation: the row
*Pääte · vain luku — avaa koko näkymään* under a live worker whose
conversation Habitat reads (`worker-terminal-row` in
`web/src/components/Spinoffs.tsx`) is pointless: it opens nothing useful when
the agent's own conversation already shows well. Remove it for a readable
worker. The terminal stays reachable where it matters: the awaiting-input
card's *Näytä pääte* (a prompt only the native terminal can answer), the
terminal card for an unreadable harness, and the Workers panel. Jari's
direct request; no prototype. Screenshot `evidence/`.

## Acceptance Criteria

- [ ] No terminal row under a readable live worker or helper; awaiting-input and unreadable-harness paths still reach the terminal.
- [ ] Explain-mode card and UI reference no longer describe the row; touched specs green.
