---
created: 2026-10-13
updated: 2026-10-13
type: improvement
reporter: jari
status: done
priority: high
related: ['@fast-clean-gate']
lane: release-tooling
preparation: ready
closed: 2026-10-13
closed_by: claude
---

# Make the test suite an order of magnitude faster and scopeable

Jari (2026-10-13): after `fast-clean-gate` a changed tree still takes
235–290 s through the clean gate (browser 133 s, Go and contracts 111 s, run
one after the other). He wants an order-of-magnitude speedup on both the
browser and the Go side, with concurrency of the two phases as a further 2x
on top.

## Questions to answer with evidence

- **Are the tests the right ones?** Map what each browser spec and Go test
  package actually proves. Some cases probably re-prove what another test
  already covers at a cheaper layer (for example a browser journey asserting
  rendering that a component test already pins, or Go tests rebuilding the same
  fixtures repeatedly). Remove or move down to the cheapest layer what is
  redundant; keep tests that are the only evidence of a behaviour. Tests of the
  security boundary (Unix user separation, daemon trusting no identity claim,
  gateway authorization, provisioning broker) stay unless an equivalent test
  provably covers them.
- **Where does the remaining time go?** Per-case host start-up, waits and
  timeouts, fixture construction, Go compilation versus execution, contracts
  validators, the VM self-test, Storybook.
- **Can the caller narrow the run?** A focused invocation (by area, spec, tag or
  Go package, or derived from the changed paths with an explicit fallback to
  full) gives fast feedback. A narrowed run never writes a full clean-gate
  receipt and says what it skipped.

## Acceptance Criteria

- [ ] The browser and Go/contracts phases of a changed-tree clean gate run concurrently, and the whole gate on a changed tree is far below its current 235–290 s; the result records the measured phase times before and after.
- [x] `result.md` has a coverage map of removed, merged or moved tests with the test that now carries each removed proof.
- [x] `ci-local.sh` (or a sibling script) accepts a caller-chosen narrower scope; the narrowed run never writes the clean-gate receipt, and `TESTING.md` describes it.
- [ ] The clean gate still passes in full and `release_test.py` accepts its receipt unchanged.
