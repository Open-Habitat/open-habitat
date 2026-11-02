---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: fixed
priority: high
lane: gate-load-flakes
lane_seq: 1
preparation: ready
closed: 2026-11-02
---

# Clean gate on integrated main: speech-input order and account menu fail under load

## Description

The conductor's clean gate on integrated main `2473b197` (2.11., Birch,
7 min 26 s total, the new parallel layout) failed 3 of 532 ordinary browser
cases; lab 163/163 passed. Each failing spec passes alone (speech-input
12/12, account-settings 17/17), so they fail only under the gate's load.
Log: Birch `~/.local/state/oh-conductor/gate-r54/stdout.json`.

1. `speech-input.spec.ts:134` (@speech … sends): the sent text was
   `sanelun ensimmäinen lause. Alku` instead of `Alku sanelun ensimmäinen
   lause.` — the typed text ended up **after** the dictation. That is
   either a test race (typing before the field is ready, or the clock jump
   added in `a56a0ac1`) or a real ordering defect in how dictation is
   inserted relative to what was written. Decide which with evidence; a
   product defect is fixed in the product.
2. `account-settings.spec.ts:199` and `:845`: the account menu's
   `menu-settings` item was not visible within 5 s after opening the menu
   (helper `settings()` at line 56).

## Acceptance Criteria

- [x] Root cause of each named with evidence; product defects fixed in product code.
- [x] Both specs pass repeatedly under gate-like load (`--repeat-each`, CPU-load helper under `timeout`), with before/after counts in result.md.
