---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
collision: [web/src/components/ExperimentalFeatures.tsx]
preparation: ready
---

# Graduate lists inside the message field to a default feature

## Description

Jari 8.11.2026: *Listat kirjoituskentän sisällä* (`composer-lists-in-field`)
is ready enough to leave Settings › Kokeelliset ominaisuudet and be on for
everyone with no switch. Same pattern as `graduate-three-experimental`:
remove its card, catalog entry and `useExperimentalFeature` gate so the
in-field lists (with the shared `@`/file-button list of `at-file-list-shared`)
are the only path; delete the old popover lists and the off-path code and
their tests rather than leaving dead branches (the Ctrl+P picker stays if the
in-field path still uses it); drop a stored preference harmlessly. Update
specs that turned it on (the `lab-composer-lists-in-field` spec may move out
of the lab), settings search, explain mode and the agent UI reference.

## Acceptance Criteria

- [ ] A fresh account gets the in-field lists with no setting; the card is gone.
- [ ] No gate or off-path code for the id remains.
- [ ] Composer specs green; `KOKEILTAVAA.md` line.
