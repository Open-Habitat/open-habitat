---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying the attention-sound browser specs
source_ref: taskfleet:01m7zpqphvvvd96mj4nb95ymtt/observed:rail-icons-quiet-deterministic-3
originating_run: 01m7zpqphvvvd96mj4nb95ymtt
originating_run_kind: spinoff
---

# rail-icons-quiet spec fails three Hiljaiset cases deterministically on main

## Description

## Problem

On an unchanged `main` (7b6b8d38), `web/tests/rail-icons-quiet.spec.ts` fails three of its four cases with `OH_BROWSER_WORKERS=2` on the synthetic browser host, on every run tried (twice on a feature branch, once on main):

- `:120` every other conversation as one flat list — `quiet.getByTestId("agent-item-<quietId(8)>")` has count 0 where 1 is expected (line 131); the newest Hiljaiset conversation is not in the quiet list.
- `:191` the icon grid orders and narrows — `rail-quiet-menu` never appears, so the click at line 218 times out after 120 s.
- `:322` folding is per device — the fold's `aria-expanded` stays `false` where `true` is expected (line 337).

All three read the quiet fixture conversations (`quietId(n)`); the case that does not (`:413`) passes. That points at the quiet fixture set or the Hiljaiset section rather than at the assertions.

## Reproduce

`OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec rail-icons-quiet.spec.ts` on main: 3 failed, 1 passed (2.2 min).

## Done when

The spec passes on main, or its cases are changed to the rail's current behaviour with the reason recorded.
