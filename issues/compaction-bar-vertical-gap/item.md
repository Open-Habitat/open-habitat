---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-14/compaction-bar-gap
lane: unlaned
lane_seq: 1
collision: [web/src/app/BrowserConversation.tsx, web/src/components/components.css]
preparation: ready
closed: 2026-11-14
---

# Compaction bar sits against the element above it

## Description

Observed on the test server (14.11.2026, desktop width): the "Agentti
tiivistää keskustelua…" bar above the composer sits almost against the
element above it (a message card in the timeline, here a held/queued
message), with only a couple of pixels between their borders. The gap below
it (to the composer's attachment row) is about the normal gap, perhaps a
little narrow. Both gaps should follow the conversation's normal vertical
rhythm between stacked elements above the composer.

Component: `web/src/components/CompactionNotice.tsx`, styled by
`.ah-compaction-notice` in `web/src/components/components.css`, placed in
`web/src/app/BrowserConversation.tsx`.

## Acceptance Criteria

- [x] Both notice gaps match the existing composer-stack rhythm after normal replies and held messages, with and without attachments, at desktop and phone widths in all three themes.
- [x] Bounding-box regression assertions and private before/after synthetic captures demonstrate the change.
