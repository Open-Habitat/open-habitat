---
created: 2026-11-03
updated: 2026-11-03
type: bug
reporter: claude
status: open
priority: high
lane: gate-reds
lane_seq: 2
preparation: ready
---

# Gate under load: a daemon wake test and the PDF attachment spec fail intermittently

## Description

Third clean gate 3.11. (`8ee15f1a`, 6 min 37 s): 538/539 ordinary, lab
164/164, and one Go failure. Both pass alone (Go test 5/5, spec 2/2), so they
fail only under the gate's load. Log: Birch `~/.local/state/oh-conductor/gate-r56c/`.

1. `internal/daemon` `TestThePersonsStopAfterATypingWakeHoldsAcrossARestart`
   (`wake_linux_test.go:283`: "the person's stop is not in the branch"),
   added with the race-input-before-ready daemon change (`3282082c`). A
   timing assumption in the test, or a real ordering defect in how a
   person's stop after a typing wake is written to the native branch.
2. `attachment-documents.spec.ts:221` (PDF with an embedded font, old
   browser simulation): the attachment chip never appeared within 30 s.

## Acceptance Criteria

- [ ] Each mechanism named with evidence (Go: `-count` under CPU load and `-race`; spec: seeded reply delay `--repeat-each`), product defects fixed in the product, tests kept strict.
- [ ] Counts before/after in result.md.
