---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m71zxxabyvwy0h1y2tec6n4g/observed:skill-block-load
originating_run: 01m71zxxabyvwy0h1y2tec6n4g
originating_run_kind: spinoff
---

# Full skill-message block sometimes stays at its preview after Load under reply jitter

## Description

On Birch, unchanged product/spec tree fa85393db, the focus-sweep baseline with `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=sweep-focus OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300` failed `web/tests/lab-skill-invocation.spec.ts:158` in the 1440/light variant. After clicking `history-block-load` on the large user message, `ARGUMENT END` never appeared within the assertion budget; the preview and load button remained. Other five skill-reader variants passed, and this variant had already passed its reader open/Escape checks. Ordinary focus baseline: 27 passed, one native-editor prerequisite skip; lab baseline: 15 passed, one failed.

No product, fixture or spec changes precede this baseline (the worker only changes focused-run defaults/docs). This is therefore a failure on the main source tree, not a regression from the sweep completion. Investigate whether the load press is lost during a history remount or the block response is discarded. Do not add blanket retries or weaken the native-content oracle without establishing the cause.

Raw disposable log: `/var/tmp/load-sweep-focus.log`. The seed reproduces the request-delay sequence, not OS/browser scheduling. This is a concrete detector failure; no claim is made yet that a person reliably loses access to the full block.

## Comments

### 2026-11-10T05:53:22Z · @load-race-sweep

A second unchanged-tree run with seed sweep-lab-repeat and --repeat-each 3 failed the same 1440/light block-load assertion once (17 other skill-reader executions passed; all 12 attachment-picker executions passed). Log: /var/tmp/load-sweep-lab-repeat.log. Reader Escape/focus checks preceding block expansion passed in the failing execution too.
