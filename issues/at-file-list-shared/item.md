---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: done
priority: normal
lane: at-file-list-proto
lane_seq: 2
blocked_by: ['@proto-at-file-list']
collision: [web/src/components/composer/Composer.tsx]
preparation: ready
closed: 2026-11-08
---

# Typed @ and the file button open one shared file list

## Description

Implementation of Jari's decision on `proto-at-file-list` (round 1,
**Yhteinen**, 8.11.2026). The prototype is the specification:
`design-system/prototypes/rounds/2026-11-08-at-tiedostolista/` direction 4
(its diff against the unchanged production copy committed first is the spec)
and `issues/proto-at-file-list/evidence/r1-d4-*`.

The file button writes `@` into the text at the caret and opens the list;
typed `@` opens the same list. The list has the button list's search line
and keys, but the search is the `@` word in the text (typing goes to the
text). Tab marks (as in the button list today), → shows the file in its
folder, preview stays; Esc closes and leaves the typed text. Applies to the
in-field lists (`composer-lists-in-field`); keep that feature's existing gate
as it is.

## Acceptance Criteria

- [x] Button and typed `@` open the identical list; typing after `@` filters
      it from the text; Tab marks; Esc keeps the text.
- [x] `lab-composer-lists-in-field.spec.ts` and touched composer specs green;
      `KOKEILTAVAA.md` line.
