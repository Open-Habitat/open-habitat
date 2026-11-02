---
created: 2026-11-02
updated: 2026-11-02
type: task
reporter: jari
status: open
priority: high
lane: gate-load-flakes
lane_seq: 3
preparation: ready
---

# Find every load-sensitive browser case in one sweep instead of one gate at a time

## Description

Jari 2.11.: there is a lot of "the test fails under load". Each clean gate
on 2.11. surfaced 2–3 new load-only failures (r54 gate 1: speech-input,
account-settings ×2; gate 2: next-waiting-row, settings-search), and each
investigated one so far was a **real product timing defect** (caret and
focus lost across load-time view swaps, a re-render per live event that made
the page lag seconds behind). Load acts as a race detector, but finding the
races one gate at a time costs a gate and a worker round each.

Do it once, as an analysis first (no product changes in this unit): run the
whole ordinary and lab suites under deliberate slowness — Chromium CPU
throttling through CDP (`Emulation.setCPUThrottlingRate`, e.g. 4×) and/or
`timeout`-bounded busy loops, `--repeat-each 3` — collect every failing
case, and group them by mechanism (focus/caret after a view swap, a status
read arriving after the event it describes, list order changing after
render, a spec waiting on the wrong signal, …). For each group: product
defect or spec defect, what a person would see, the shared fix (a helper or
pattern that removes the class, not one fix per spec). Recommend how the
gate keeps catching this class cheaply afterwards (for example a throttled
repeat of the recently changed specs, or a periodic stress run outside the
gate).

## Acceptance Criteria

- [ ] One list of all load-sensitive cases with counts, grouped by mechanism, product vs spec, and a fix per group.
- [ ] A recommendation for keeping the class caught; no product code changed in this unit.
