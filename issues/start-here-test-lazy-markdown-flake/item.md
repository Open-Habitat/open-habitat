---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: worker gate run
source_ref: taskfleet:01m5pe2kb30cvfwmdhccd3k9pd/test-run:starthere-lazy-markdown
originating_run: 01m5pe2kb30cvfwmdhccd3k9pd
originating_run_kind: spinoff
lane: unlaned
preparation: ready
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
