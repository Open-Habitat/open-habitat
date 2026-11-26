---
created: 2026-11-26
updated: 2026-11-26
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying truly-moaning-car
source_ref: taskfleet:01m8ba0av8n07xpsvw4v2wxppe/observed:dictation-bar-layout-flake
originating_run: 01m8ba0av8n07xpsvw4v2wxppe
originating_run_kind: spinoff
---

# dictation-bar spec measures the composer row before it settles under parallel load

## Description

`web/tests/dictation-bar.spec.ts` measures the composer row's layout and fails intermittently when run with several workers. Seen at `5d5c820fb` (product code unchanged) in four runs of `npx playwright test tests/speech-input.spec.ts tests/dictation-bar.spec.ts --repeat-each 3 --workers 4`:

- `dictation-bar.spec.ts:135` ("the bar covers the aids, Valmis takes Sanele's place, and nothing moves …") failed in 2 of the 3 repeats of one run;
- `dictation-bar.spec.ts:218` (the 360 px phone variant) failed once in another:

  ```
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 0.5)
  Expected: <= 223.5
  Received:    259
    at apart (dictation-bar.spec.ts:126)
    at dictation-bar.spec.ts:252   // apart(aids[2], working.chip)
  ```

The other runs were green, and a 3-worker run of `:135` alone was green. The working-state boxes are probably read right after `composer-stop` appears, before the row has finished laying out (the Ohjaa chip arriving or changing width), so the spec measures a transient. It should wait for the layout it asserts. If the row really does overlap for a moment, that is a product defect. Either way, find out which before changing the spec.
