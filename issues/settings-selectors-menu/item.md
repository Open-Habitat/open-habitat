---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: normal
lane: settings-layout
lane_seq: 1
related: ['@proto-settings-selectors']
preparation: ready
---

# Settings selectors: menu for many choices, compact steppers

Jari 1.11. accepted direction **2 · Valikko monelle** from `proto-settings-selectors` (prototype and result.md there are the specification): a choice of many long options (Language, and server default language) is a menu with per-option notes; short choices stay segments; steppers are compact with the number and − / + together. Katsauksen laajuus (four short levels): keep it a segment if it fits the row in both languages at the settings widths, otherwise use the menu; record the choice. A number names its unit (*5 keskustelua*) when it fits well. Not gated: a fix to how existing settings look.
