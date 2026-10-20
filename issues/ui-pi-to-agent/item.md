---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: web-chrome
lane_seq: 3
collision: [web/src/strings]
closed: 2026-10-20
---

# UI says 'Pi' everywhere; ordinary users should see 'Agentti'

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: chat and UI texts say Pi here and there ('Kirjoita Pi:lle', 'Pi:n kuittaus', 'Odottaa Pi:tä' …). Pi is an implementation detail; ordinary users should see 'Agentti' (or similar). Replace in user-facing Finnish strings; keep Pi where it is genuinely the product name (e.g. a settings section about the native Pi installation, SSH instructions) and say so in the result. Coordinate with the design-system voice.

## Acceptance Criteria

- [x] Ordinary conversation, composer, progress, delivery, history and workspace copy refers to the assistant as agentti, with Finnish inflections.
- [x] Native Pi credential/settings references and protocol identifiers remain unchanged.
- [x] Existing interaction expectations follow the new copy; focused validation and its baseline exceptions are recorded in result.md.
