# Result

On base `fd92276906d1e9e8d7beae33f334552dd972db49`, changed only
`web/src/components/CodeMirrorEditor.test.tsx` and this issue's records.

The component already destroys its EditorView on unmount. The test now controls
requestAnimationFrame/cancelAnimationFrame so jsdom cannot run unsupported
layout measurements between async merge assertions. Teardown unmounts the views,
drains pending animation frames and deferred conflict-widget unmounts inside
React act, asserts that no fake timers remain, and restores real timers even
on failure. No shared Range geometry stubs or product code changes were needed.

Verified:

- `cd web; for i in $(seq 1 10); do npx vitest run src/components/CodeMirrorEditor.test.tsx; done`: ten consecutive passes, three tests each, no unhandled errors.
- `TMPDIR=/var/tmp ./scripts/test-web-fast.sh`: passed format, lint, typecheck and all unit/component tests. The first invocation stopped at a formatting discrepancy; after formatting the changed test, the full command passed.
- `git diff --check`: passed.

The final formatting-only adjustment was also covered by the full web test run.
No browser, Go, contracts, packaging or full clean-gate evidence is claimed;
this is a test-lifecycle-only fix.
