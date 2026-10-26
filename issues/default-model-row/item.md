---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: done
priority: normal
lane: ui-impl
lane_seq: 4
collision: [web/src/app/, web/src/components/Account.tsx]
preparation: ready
closed: 2026-10-26
---

# Tekoäly page: default-model row as Asetusrivi with a compact select button

## Description

Implement Jari's verdict on proto-integration-grouping round 3 (Decisions there; prototype issues/proto-integration-grouping/prototypes/settings-riff-3): the Asetusrivi layout, with Valintakenttä's select-style button at the size of Asetusrivi's interactive part, opening the Ponnahdus model chooser (popover; sheet on phone). Replaces the block settings-three-pages left replaceable.

## Acceptance Criteria

- [x] Row and popover as accepted on desktop and phone; browser test for opening, choosing and focus return.

