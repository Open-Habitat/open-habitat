# Result

Closing the last shell tab now hides the panel and clears its notice. The
explicit close owns the outcome rather than racing the socket's exit notice;
failed writes still warn and reconnect. Reopening uses the fresh terminal list
and starts one usable shell with none of the closed shell's environment.
Non-last-tab close and native `exit` behavior are unchanged.

Verified against base `20b0dda4` plus this issue's fixing diff:

- Reproduction before the fix: focused host-backed last-tab case failed because
  the panel remained visible (45s including remote setup).
- Final `cd web && npx playwright test tests/browser-shell.spec.ts`: **10 passed**,
  14.0s Playwright / 16s command, including existing tab, shortcut, phone,
  connection-loss and axe checks. Log: `/var/tmp/shell-last-close-browser-fresh-list.log`.
- Final `./scripts/test-web-fast.sh`: **81 files / 471 tests passed**, plus format,
  lint and typecheck, 23s command. Log: `/var/tmp/shell-last-close-web-fast-fresh-list.log`.
- `git diff --check`, project-view validation and `issuectl doctor --json`: passed.

Failure inventory: the expected pre-fix reproduction is in
`/var/tmp/shell-last-close-repro.log`. Initial test edits needed a lint correction
and formatting (`shell-last-close-web-fast*.log` under `/var/tmp`). The first
fixed-code browser run matched an unrelated page status in the notice check
(`/var/tmp/shell-last-close-browser-fixed.log`); it was narrowed to the toast
using a stable test id and passed. No required check remains failed/incomplete.
Self-reviewed the close/socket ordering, selection and refusal reconnect paths.

Synthetic evidence uses the real gateway, daemon, tmux and bash with invented
homes, not distinct UIDs or live-server data. No Go, contracts or packaging
changed; their checks and the full gate were not run. Not deployed by this
worker: add the Finnish try-it entry after the conductor deploys the change.
