# Result

The workspace's shared create/update callback now prepares `/skill:open-habitat-start-page `, Pi's explicit skill invocation. The draft, focus, caret and explicit-send flow are unchanged. No presentation redesign or daemon production change.

## Evidence

Tested on base `16d41664` plus this issue's diff:

- `./scripts/test-focused.sh --area web`: 168 files / 1258 tests passed, static checks passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, including `TestStartPageButtonNativeExpansion`, which installs the shipped skill and uses pinned Pi 1.3's real expander on the exact argument-free sent text. Native history parsing recognizes the result as a skill call.
- `OH_PORT_BASE=11500 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-workspace-landing.spec.ts`: both desktop/mobile cases passed, including accessibility checks, draft/caret assertions and the actual POST message assertion. Host-backed synthetic evidence, not live provider execution.
- `git diff --check`: passed.

Initial browser assertion incorrectly expected the trailing space to be stripped; corrected it to preserve the existing send behavior and made the native expansion test exercise that exact text. Initial Go run lacked Python `referencing`; installed requirements-ci.txt into a disposable uv environment and reran successfully. Logs: `/var/tmp/oh-start-page.AOfqHO` (temporary).

## Focused self-review

Checked the shared create/update callback, draft preparation tests, outgoing payload and Pi expansion. The previous bare invocation fails the browser contract; the native test verifies that the corrected command becomes a skill call rather than plain text. No authority, session-state or contract changes; independent review was not required. Live model execution and the separate presentation prototype remain unverified here.

## Decisions for later review

None beyond the brief: keep the existing trailing space and explicit-send flow, correcting only Pi's invocation syntax rather than introducing a host-side command path.
