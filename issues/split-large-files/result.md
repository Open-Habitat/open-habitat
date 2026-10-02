# Result: split-large-files

Implemented in `bb7a938` and `515bddc` (the same validated implementation tree as pre-stamp `f4de4e768dd627fc2c16856531d05eb613407ae0`; issue stamping rewrote only the commit message). Conversation reads, writes/notices, and reading position now live in `useConversation`, `ConversationActions`, and `useReadingPosition`; the rail lives in `WorkspaceRailView`. The daemon's Pi event handling and continuation moved into their own Linux files, and gateway session/request handling moved out of OAuth login code. No authority changed: login broker authorization stays once per session, request cookies/CSRF and daemon peer checks stay per request, and the native flock still owns single-writer admission. Architecture and review guidance explain why.

## Evidence

- `TMPDIR=/var/tmp/nah-split-build go test ./internal/daemon ./internal/gateway -count=1`: passed after fixture dependencies were installed.
- `./scripts/test-web-fast.sh`: passed after the split and after the focus fix (web format, lint, types, 14 unit and 71 component tests).
- Lab browser regression `NAH_PORT_BASE=14700 ... playwright test --config playwright.lab.config.ts --grep 'slow turn explains work'`: 1 passed. The test keeps focus on cancel after a harmless rerender while the abort confirmation is open.
- `python3 scripts/validate-project-view.py`: valid; `issuectl doctor --json`: clean; `git diff --check`: clean.
- `TMPDIR=/var/tmp/nah-split-build NAH_PORT_BASE=14700 ./scripts/ci-local.sh --clean --json`: passed on pre-stamp `f4de4e7` in `/var/tmp/nah-split-final-gate-retry.log`. It covers browser, Go, contract, packaging and documentation checks; it does not claim live multi-UID isolation.

Independent review (claude-fable-5-1, verified by gpt-6-astra) found a newly expanded dependency array that refocused the destructive abort button on the next render. Fixed in `515bddc` (pre-stamp `f4de4e7`), with the focus regression covered in the lab test. No review residual is filed. The review and assessment are local scratch at `history/review-split-large-files.md` and `history/assessment-split-large-files.{json,md}`.

## Attempts and limits

An initial focused Go test failed because the ignored Pi SDK fixture dependencies had not been installed; `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund` restored the prerequisite and the tests passed. The first focused Playwright command used the default config, which excludes `lab-*` tests, and returned “No tests found”; the lab-config retry passed. The first final clean-gate attempt failed two pre-existing SSE lab tests (a provisional delta visibility timeout and a cursor resnapshot count timeout). Both passed when rerun together in isolation, and the full clean gate passed on the next attempt without code changes. The earlier pre-fix clean gate also passed on `bb7a938`. Logs: `/var/tmp/nah-split-final-gate.log`, `/var/tmp/nah-split-final-gate-retry.log`. No real provider behavior or live-server isolation was tested here.
