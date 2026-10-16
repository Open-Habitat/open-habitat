---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Flicker and jumps while new messages arrive

Jari 2026-10-16 14.2x: while new messages arrive, a "Tarkista keskustelun tila" label sometimes flickers below, and in general "uusien viestien tulemisessa on jotakin pomppivaa. Jotain on välillä näkyvissä ja välillä ei." (In short: something jumps while new messages arrive; things appear and disappear.) Find every element that toggles during a live turn: status labels, the recap, the process row, Viimeisimpään, the composer state and notices. Remove the flicker: a state shows only when it is stable (with hysteresis or a minimum duration), and the layout does not jump.

## Acceptance Criteria
- [ ] A recorded live-turn browser test (frame sampling or a mutation log) shows no transient "Tarkista keskustelun tila" and no layout shift above a small threshold during streaming.
- [ ] Before and after screen recordings or frame strips in the issue directory.
