---
created: 2026-10-20
updated: 2026-10-20
type: task
reporter: jari
status: done
priority: normal
lane: proto
lane_seq: 2
collision: [design-system/prototypes]
closed: 2026-10-20
---

# Prototype round 2: ! command history in a real conversation context

_Source: chat:proto-feedback-2026-10-20_

## Description

Jari's feedback 2026-10-20 on proto-bash-runs (https://glasspad.example.test/p/coyjnswccxiytkq6hyxpmeexem/, directions Kortit / Loki / Nippu; result in issues/proto-bash-runs/result.md): the 'Kirjoita Pi:lle' field is far too narrow — it must have the production composer's real width and layout. The round must show how the command runs position relative to the other elements of a real conversation: user messages, agent replies, interim stages and their work rows, process tray/status overview, the bottom row and notices, desktop and phone. Rebuild the three directions (or fewer if one is clearly out) inside a faithful copy of the production conversation layout (web/src/components), keep the notice states from round 1, publish to glasspad, update KOKEILTAVAA's Prototyypit section (replace round 1 items).

## Acceptance Criteria

- [x] Three directions show command history inside the production-sized conversation, with full-width composer, work rows, process overview and notices.
- [x] Published round replaces round 1 in KOKEILTAVAA.
- [x] Final remote browser checks pass at 1440, 1366 and 390px in both themes; focused web checks pass.
