---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet worker observation
source_ref: taskfleet:01m84x3pd5waswstx7r2r8q0f0/speech-input-hour-ceiling-main-failure
originating_run: 01m84x3pd5waswstx7r2r8q0f0
originating_run_kind: spinoff
---

# speech-input spec: the hour-ceiling cases fail on main

## Description

## Description

Two cases in `web/tests/speech-input.spec.ts` fail on main (seen 2026-11-23 at
`ab04fe62c`, focused run
`./scripts/test-focused.sh --area browser --spec speech-input.spec.ts`; the
other 14 speech cases pass):

- "@speech the dictation warns at the hour limit and ends with the text"
  (line 634): `getByTestId('dictation-ceiling')` never becomes visible.
- "@speech a scripted seam finalizes old tokens before new ones and the hour
  keeps both in the composer" (line 693): `dictation-notice` never gets
  `data-notice="ceiling"`.

Both wait for the dictation's hour ceiling, so the browser's ceiling notice
(or the way the cases advance time to it) no longer matches. The same two
cases failed identically on a feature branch that touched neither dictation
nor `speech.ts`'s behaviour.

## Done when

Both cases pass, or the cases are changed to match an intended change in
how the ceiling is announced.
