---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Own-computer folder says unavailable in Brave

## Description

Jari on the test server, 2026-10-21, Brave: the top of the page says 'Oman koneen kansio ei ole käytettävissä tässä selaimessa. Käytä Chromea, Edgeä tai Bravea tai lisää tiedosto liitteenä.' — while he is using Brave. Brave disables the File System Access API by default (brave://flags/#file-system-access-api). Either make it work when the API is present, or tell the truth: detect the missing API and give Brave-specific guidance (enable the flag) instead of recommending Brave in the same sentence. Decide from what Brave actually exposes.

## Acceptance Criteria

- [x] Missing picker API explains the current browser settings, manual attachments and Brave's opt-in flag instead of recommending Brave as an alternative.
- [x] An exposed picker API still offers the existing explicit folder grant; no browser-brand detection overrides capability detection.
