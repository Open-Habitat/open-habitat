---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-27/live-tail-bound-raise
lane: conversation-live
preparation: ready
---

# Raise the live-tail bound beyond 128 frames

## Description

Jari 2026-10-27: live-gap-banner-returns found that long tool-calling runs overflow the daemon's 128-frame live tail (history entries are published only at settlement); its fix resumes the tail at turn_start and clears the notice after a post-miss native read. Jari: 'Kasvatetaan rajaa.' Raise the bound to a size that covers realistic long turns (measure frame counts and bytes of long Birch turns), keeping memory per conversation bounded and stated; tests at the new boundary.

## Acceptance Criteria

- [ ] The bound is raised with a measured justification, memory stays bounded, and a test covers the new limit
