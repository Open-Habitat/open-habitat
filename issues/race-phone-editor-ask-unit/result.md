# Result

The phone-editor crossing test now awaits React's async startup and resize work
and finds the question asynchronously. No production code or timeout changed.

## Cause and change

`mintEditorHandoff` resolves asynchronously; `setFrame` mounts the iframe and a
`useEffect` replaces the resize listener with one that captures that frame.
The old test clicked synchronously, waited only for the iframe DOM, then used
unawaited synchronous `act` calls and immediate question queries. DOM presence
alone did not explicitly flush that promise/effect sequence before the crossing.
The component itself asks from the resize handler, not a timer.

The test now wraps opening in awaited async `act`, awaits each resize (including
restoration), and uses `findByTestId` for each appearance. It still verifies the
same frame remains usable, staying suppresses another question below the
breakpoint, crossing back asks again, switching removes VS Code and the question,
and native `confirm` is never called. The Finnish-copy assertion was replaced
with presence of the stable test id, as required by TESTING.md.

## Verification

Tested on Birch from base `83bcaaeef` with this test-only diff:

- `npm ci --prefix web`: passed.
- Thirty separate `npx vitest run src/app/WorkspaceEditor.test.tsx` invocations
  beside four `timeout 290 yes` CPU hogs: 30/30 passed (150 test executions).
  The whole loop had `timeout 300`; its exit trap stopped its hogs.
- `timeout 600 ./scripts/test-focused.sh --area web`: passed; 206 files,
  1553 tests, plus static checks and TypeScript. Two existing informational
  Biome diagnostics in `conversationStore.test.tsx` did not fail the check.
- `git diff --check` and `issuectl doctor --json`: passed.

Logs are local scratch under
`/var/tmp/phone-ask-01m72dvtccnj87g1tnmk50yr3f/` (`repeat-1.log` through
`repeat-30.log`, `web.log`). No pre-fix reproduction was run: the original
failure is the gate evidence recorded in the issue; the exact scheduler
interleaving of that failure is not proven by this run. These results establish
loaded unit stability for the tested runs, not live VS Code or browser evidence.
No browser suite or clean gate was run, as requested.

## Review

Focused self-review of the final diff against the component's handoff and resize
flow. Low risk: only one unit test changes, with its once-per-crossing and
frame-lifetime assertions retained. No session, contract, daemon or authority
boundary changes; an independent model review was not warranted.

## Decisions for later review

None. No product behavior changed, so no KOKEILTAVAA entry is needed.
