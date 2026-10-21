# Native test script salvage — 2026-10-21

Salvaged the retained tree of `wt/y7nbyxn70q-native-tests-under-120s`
(commits 3fa9d5d3, 99e98f1c, 826311cd, e0d89596) onto 32ba70d5, preserving
main's integration changes and current issue body. The old branch is superseded;
the conductor can discard it after this lands. The issue stays open.
`native-results-20261021.md` is preserved unchanged as the previous run's
historical evidence, not evidence for this tree.

## Retained and changed

Removed the FIFO adapter, placement checks, task declarations, ARM receipt
writer and dispatch-only tests. Those tests distinguished old dispatch/control
failures, not product behavior; their implementation is gone. No application
assertion was removed. Kept overlapping Go/Storybook with web checks, one Vitest
invocation (477 unique assertions rather than overlapping selections), cached
npm downloads, both browser configurations after a failure, and packaging after
heavy failures without a passing receipt. Both release reproducibility builds
still compile the product; the extra unversioned build is gone.

Ordinary `npm`, `go` and `npx playwright test` now retain the caller's PATH.
Removed the duplicate web-command catalog/Python executor in favor of ordinary
npm scripts. Playwright global setup retains the fresh-build guard
`OH_WEB_PREBUILT` and no longer overrides Go's PATH. Browser worker settings
from the caller/backend are preserved. Fleetrepo owns placement; this tree
contains no host selection, remote client, namespace or bubblewrap wrapper.

99e98f1c's process-observation change was a PID namespace wrapper, not a fixture
fix; 826311cd withdrew it completely. There is no separate fixture fix to carry.

## Bounded verification

All measurements are single runs under shared-host load, `TMPDIR=/var/tmp`.

| Check | Result | Wall seconds |
| --- | --- | ---: |
| `npm ci --prefix web --prefer-offline --no-audit --no-fund` | passed | 3.34 |
| `./scripts/test-web-fast.sh` | 81 files, 477 assertions passed | 28.17 |
| `./scripts/test-focused.sh --area contracts` | generated inputs and contracts passed | 0.88 |
| remaining `scripts/test-*.py` | 11 existing script tests passed | 5.12 |
| `./scripts/test-focused.sh --area browser --spec theme.spec.ts` | 3 passed, 2 workers | 21.91 |

Fast web and contracts used the installed ordinary-command shims. For the
explicitly requested **native** browser smoke run only, the validation shell
omitted `$HOME/bin` from PATH; no repository script does this. It used
`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=25300`, `umask 077`, fresh production assets
and the normal `npx playwright test` entrypoint. This is native entrypoint
proof, not warm-Cedar routing proof.

`bash -n` passed for all three changed shell scripts. Project-view validation,
`git diff --check` and focused self-review passed. No daemon/product code,
assertions or contract shapes changed; no model review was required or run.
No full gate, full browser suite, release or deployment was run, as requested.
No full-suite health or under-120-second result is claimed.

Logs: `/var/tmp/oh-salvage-{dependencies,web-fast,contracts,script-tests,native-browser}.log`.

## Failure inventory and Fleetrepo integration caveat

- Optional private-HOME shim diagnostic: `HOME=<empty disposable directory>
  go version` exits 127 because installed `~/bin/go` invokes
  `$HOME/bin/fleetrepo-heavy-command`. Log:
  `/var/tmp/oh-salvage-shim-home.log`. The gate deliberately uses a private
  HOME, so Fleetrepo's parallel routing work must support synthetic HOME
  (including its config/module lookup), not depend on HOME naming the account's
  installation. No privacy weakening or shim bypass was added to the gate.
  This does not invalidate the bounded passing checks; full gate integration
  remains unverified and was explicitly outside this run's checks.
- The cherry-pick conflicted only in the issue body; resolved by retaining
  current main's body, while preserving the previous results file separately.
- Discovery mistakes: one skill read used the wrong path, then the supplied
  path succeeded; probes for a nonexistent global-setup file, `.tools`, and
  package-local `npx` were corrected to the existing host-build file and PATH
  tools. No required capability or check was skipped because of these probes.
- Browser output includes the existing PostCSS `from` option warning; all three
  assertions passed. No subsidiary agent/service/review failed or was launched.
