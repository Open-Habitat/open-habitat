---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: worker gate run
source_ref: taskfleet:01m5pe2kb30cvfwmdhccd3k9pd/test-run:starthere-lazy-markdown
originating_run: 01m5pe2kb30cvfwmdhccd3k9pd
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# StartHere unit test flakes on lazy Markdown under load and fails the gate

## Description

`StartHere.test.tsx > repository start page > renders only authored goals and
sanitized free text, and emits only draft intent` fails intermittently under
load with `AssertionError: expected undefined to be 'Repository intro'`: the
lazily loaded Markdown renderer has not rendered the intro when the assertion
runs. Alone it passes (3/3), and it passed in two full web runs on the same
tree, but it failed the web-checks phase of `./scripts/ci-local.sh --clean`
on 2026-10-24 (tree of the `editor-replace-note-sticky` branch, no StartHere
change), so the gate wrote no receipt.

The same timeout was seen earlier and noted only in the results of
`raw-entry-appended-row` and `header-missing-after-shell-change`. Likely fix:
await the lazy Markdown (findBy… with a generous timeout, or preload the
module in the test) instead of a synchronous query.

## Acceptance Criteria

- [x] Preload the real Markdown renderer before StartHere assertions so cold module loading does not consume the render polling timeout.
- [x] Run the StartHere file successfully in 20 fresh Vitest processes.

## Result

`web/src/components/StartHere.test.tsx` now awaits the real renderer import in
`beforeAll` with a 30-second setup budget. The existing `waitFor` still waits
for React's lazy render, and the native-content, sanitization and draft-intent
assertions remain unchanged. No production behavior or mocks changed.

Validated on the worker tree based on `b448fc26`:

- `for i in $(seq 1 20); do npm test --prefix web -- src/components/StartHere.test.tsx || exit; done`: 20/20 fresh processes passed, 14 tests each.
- `TMPDIR=/var/tmp ./scripts/test-web-fast.sh`: passed formatting, lint, TypeScript and the full unit/component suite.
- `issuectl doctor --json` and `git diff --check`: passed.

Browser, Go, packaging and the full clean gate were not run: this changes only
test setup, not shipped browser behavior. Repeated isolated runs establish the
requested regression evidence, not a claim that every possible host load was
simulated.
