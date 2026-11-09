---
created: 2026-11-09
updated: 2026-11-09
type: feature
reporter: jari
status: open
priority: normal
lane: shares
lane_seq: 1
preparation: ready
---

# Shares page (Jaetut): conversations by latest activity with their shares

## Description

Implementation of `proto-shares-own-place`, round 4 *B Keskustelut
viimeisteltynä* (Jari 9.11.2026: "tämä viimeistely on hyvä, mennään tällä").
Specification: the round-4 section of `issues/proto-shares-own-place/result.md`
(page, list, selected share, phone, empty page, host facts, decisions for later
review) and `design-system/prototypes/rounds/2026-11-09-jaetut-keskustelut/`.
Earlier rounds in the same result.md give the context (own place in
navigation, round 1).

New feature: behind an experimental feature (Settings › Kokeelliset
ominaisuudet, its own card, `useExperimentalFeature`). No new host data:
conversation `changed_at` and the share records already exist. Explain cards
in Finnish and English for the page, row controls and selected-share
controls.

## Acceptance Criteria

- [ ] Page matches round 4 at 1440 and 390, light and dark, when the experimental feature is on; unchanged app when off.
- [ ] Conversations ordered by latest activity, newest first; shares under them; copy link copies the field's address; duration and remove work as in the prototype.
- [ ] Browser specs for ordering, copy and the experimental toggle; touched specs and fast web checks green.
