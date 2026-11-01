---
created: 2026-11-01
updated: 2026-11-01
type: feature
reporter: jari
status: done
priority: normal
lane: recap-can-be-off
lane_seq: 1
preparation: ready
closed: 2026-11-01
---

# Automatic recaps can be turned off

Jari 1.11.: Settings › Tilannekatsaus needs a choice that turns automatic recaps off entirely. With it, warn that the conversation descriptions on the home page then stop working, because they come from recaps. A requested recap (*Tee tilannekatsaus nyt*) still works. Per person, in the existing recap settings (`recap-settings-polish`, `contracts/v1/recap-settings.schema.json`). Not gated: a setting inside an existing section.

## Acceptance Criteria

- [x] Per-person automatic recaps can be disabled with a home-description warning.
- [x] Native settings persist off; pending and resting automatic paths respect it.
- [x] Requested recaps still run and settings can be re-enabled without losing numbers.
