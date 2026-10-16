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

# Spinoff waits show as processes; process tray lacks Poista päättyneet

Jari on the live test server, 2026-10-16 18:05–18:07 local (`spinoffit-prosesseina.png`, `spinoff-ja-prosessit.png`):
1. Spinoffs show correctly in their own group, where they can be clicked open. But the agent's `taskfleet run wait` processes **also** appear in the process tray as plain processes, so the same spinoffs show twice. A recognised `taskfleet run wait` process must not be listed as a process; the spinoff group shows it. The mechanism that brings the spinoff result back to the parent (run wait) is fine.
2. The process tray is missing the agreed **"Poista päättyneet"** button.
3. The process row has a tidy bar above the composer, but the spinoffs do not. Processes and spinoffs should appear on an equal footing and visually alike; whether in one bar or two is open. This visual question is prototyped in `proto-composer-strip` and not decided here.

## Acceptance Criteria
- [ ] `taskfleet run wait` processes never appear in the process tray; browser test with a fixture inventory.
- [ ] "Poista päättyneet" is present and works; browser test.
