---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m60fcq4r5qaz9gq4f5veyhr2/browser-shell-ctrl-d-flake
originating_run: 01m60fcq4r5qaz9gq4f5veyhr2
originating_run_kind: spinoff
lane: gate-health
lane_seq: 103
preparation: ready
closed: 2026-10-28
---

# browser-shell Ctrl-D spec loses typed input in the second shell under full-suite load

## Description

## Observation

In the whole browser suite on Birch (2026-10-28, `./scripts/test-focused.sh --area browser`, `OH_BROWSER_WORKERS=2`, run of a web-only conversation change that touches no terminal code), `tests/browser-shell.spec.ts:650` "@browser-shell Ctrl-D ends only its own shell and the last one closes the panel" failed once:

```
await page.keyboard.type("echo second-$((3+3))\n");
await expect(screen(page)).toContainText("second-6");   // line 662
Expected substring: "second-6"
Received string:    "alice@open-habitat-lab:~/src/ordinary-dir$  "
Timeout: 5000ms
```

The second shell showed its prompt but not the typed command, i.e. the keystrokes typed right after the second shell appeared were lost or not yet delivered. 422 other tests passed. Re-running the spec alone right after: 12/12 passed.

## Likely cause

The test types into the second shell as soon as `shells(...).length` is 2, before that shell's terminal is attached or focused; under full-suite load the input goes nowhere. A wait for the new shell's prompt (or focus) before typing would make it deterministic. Not checked whether the product itself drops early input to a newly opened shell; if it does, that is the real bug.
