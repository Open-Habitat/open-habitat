---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/recap-temp-dirs-not-cleaned
lane: unlaned
preparation: ready
---

# About 50 oh-recap-* directories accumulate in /var/tmp

## Description

Test server (pilot.823, 22.11.2026): /var/tmp holds about 50 oh-recap-* directories, each with recap-extension.mjs, open-habitat-ui etc. They seem to be left by every Pi start and never cleaned.
