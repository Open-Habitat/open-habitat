# Result

Fixed focus ownership in `BrowserShell.tsx`: socket readiness no longer focuses the terminal. Explicit terminal entry carries its focus request through surface mounting; arrow/click tab selection cancels that request. Reattachment preserves focus when it was already in the terminal.

The existing browser journey now holds attachment messages until an arrow-selected tab is focused, releases readiness, and checks focus after animation-frame callbacks. This forces the reported ordering without sleeps or weakening assertions. Opening a second shell and restoring the hidden panel explicitly assert terminal focus too.

## Verification

Tested base `48c80edcf7349ebeab82de97ba0a1a9cc9daadc9` plus this commit's two web-file changes:

- `./scripts/test-web-fast.sh`: passed formatting, lint, typechecking and all 478 unit/component tests; 32.01 seconds.
- `cd web && npx playwright test tests/browser-shell.spec.ts`: routed from Alder to Cedar; all 9 tests passed concurrently with 9 workers, including accessibility checks, busy-close, hide/restore and the forced readiness race. Playwright execution 15.7 seconds; total routed command 222.46 seconds.
- Self-review: checked explicit entry, tab selection, surface remount and transport-readiness paths. No authority or contract changes.
- `issuectl doctor --json` and `git diff --check`: passed.

No failed or incomplete required checks. No Go changes; no Go tests or full gate run. Evidence is synthetic host-backed browser behavior, not distinct-UID isolation or live-server verification. No deployment was performed by this worker, so no live-server KOKEILTAVAA entry was added.
