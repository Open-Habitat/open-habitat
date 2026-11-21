---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m7zpqr1ee3f3x1f81qmcksbn/test-failure:long-draft-layout
originating_run: 01m7zpqr1ee3f3x1f81qmcksbn
originating_run_kind: spinoff
---

# Browser-shell long-draft layout check fails on main

## Description

The existing browser-shell long-draft layout check fails on unchanged main at `7b6b8d3803a03220c0741a869b1117e395038213`. Its assertion that the conversation history is at least as tall as the composer never becomes true. This prevents the browser-shell spec from passing and may indicate the conversation loses its intended share of the screen with a long draft.

## Reproduction

Run with installed web and Pi SDK fixture dependencies, under `umask 077`:

```sh
OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser --spec browser-shell.spec.ts --tag 'a long draft scrolls'
```

Observed on both unchanged main and the copy-on-select removal branch: timeout at `web/tests/browser-shell.spec.ts:815`, in `holds`, called at line 823. The other 20 selected terminal/settings cases passed on the removal branch. This is synthetic host-backed evidence; the precise product cause has not been diagnosed.

## Quick Test

The reproduction should pass and a long draft should leave the conversation its intended share while the draft scrolls within the composer. Decide whether the layout or the test's expectation is wrong before changing either.
