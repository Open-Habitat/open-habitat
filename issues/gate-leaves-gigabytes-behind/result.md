# Result

Clean gates now reclaim their checkout-local dependencies, build outputs and
caches on success or failure. Receipts survive. Failure console/phase logs and
Playwright evidence survive. `ci-local.sh --cleanup [--dry-run] --json` cleans a
finished checkout without deleting its source, Git history, receipts or unrelated
ignored files. The gate and cleanup share a per-checkout lock.

## Measurement

Measured a fresh `git clone --no-local` of
`96dd6ea89e6221e170b451d3f76d309615d8ebbf`, with private HOME/XDG/TMPDIR and the
same checkout-local Go/npm/pip/Playwright cache paths as the gate. Commands ran
under umask 077, the scratch lease, timeouts and two build/browser workers.

**No full gate or whole browser suite ran.** The round's working rules prohibit
those in workers. Instead, one focused phase sequence ran: Python environment,
Go module download, both npm installs, Chromium/headless-shell installation,
production web build, Storybook, browser-host build, the two host-lifetime
Playwright cases, and one amd64 release archive plus verification. This measures
real retained bytes, not a simulated allocation or a claim of full-gate success.
The cross-built archive verifier warned that embedded identity could not be
executed on this host; archive structure verification passed.

`du -sk` (allocated KiB; each row measured separately):

| Path/category | Before phases | After phases | After cleanup |
|---|---:|---:|---:|
| Entire clone | 99,988 | 4,120,108 | 100,008 |
| `.cache/ci-local/go-build` | 0 | 658,692 | 0 |
| `.cache/ci-local/go-mod` | 0 | 345,560 | 0 |
| `.cache/ci-local/npm` | 0 | 550,204 | 0 |
| `.cache/ci-local/pip` | 0 | 1,764 | 0 |
| `.cache/ms-playwright` | 0 | 676,980 | 0 |
| `.cache/browser-host` | 0 | 35,692 | 0 |
| `web/node_modules` | 0 | 830,904 | 0 |
| Pi fixture `node_modules` | 0 | 869,420 | 0 |
| `web/dist` | 0 | 13,012 | 0 |
| `web/storybook-static` | 0 | 21,180 | 0 |
| `dist` (one archive) | 0 | 16,696 | 0 |
| `web/test-results` | 0 | 8 | 8 |
| Private phase scratch (HOME, venv, TMPDIR) | 8 | 28,516 | 0 |

The clone fell from **3.93 GiB to 97.7 MiB**, reclaiming 3.83 GiB (97.6%).
Manual cleanup deliberately retained the 8 KiB Playwright result; successful
automatic gate cleanup removes that too. The final clone includes the new
cleanup scripts copied in for the measurement and an empty `.cache` directory.
The phase scratch was measured before explicitly reclaiming it; real EXIT/TERM
scratch cleanup is separately exercised through the shell regression tests.

Outside-path snapshots:

| Shared category | Before (KiB) | After (KiB) |
|---|---:|---:|
| Original user's `~/.cache` | 4,452,236 | 4,487,532 |
| Host `/var/tmp/agent-scratch` | 32,138,092 | 32,340,804 |

Other workers ran concurrently, so these shared-total changes are **not
attributed to this run**. Its HOME/XDG caches were private; its measured scratch
was removed. Both snapshots found no `/tmp/oh-browser-*`, `/tmp/playwright*`, or
`/var/tmp/ohc.*` paths. The two host-lifetime cases exercise host and synthetic
Pi process cleanup, including launcher/host SIGKILL. No other process or shared
cache was cleaned. The browser-suite lock is a persistent tiny file; the focused
run does not acquire it. Full-gate race-test caches and all four packaging
archives were not measured; they use the same cleanup targets.

Local raw phase logs and before/after measurements are retained under
`/var/tmp/agent-keep/gate-cleanup-measure/`; they are working evidence, not public
attachments. The cleaned measurement clone is there too.

## Verification and review

- `scripts/test-gate-storage.py`: 9 tests pass. Covers dry-run, repeat cleanup,
  tracked files, symlink targets/ancestors, nested links, read-only module
  directories, shared caches, receipt/failure evidence preservation, checkout
  lock, real shell success/failure/TERM, and refusal to refresh a receipt when
  cleanup fails. Expensive phase commands in the shell tests are synthetic.
- `scripts/test-gate-receipt.py`: 4 tests pass.
- `scripts/test-project-scripts.py`: 4 tests pass.
- `scripts/test-test-focused.py`: 12 tests pass.
- `scripts/validate-project-view.py`, shell syntax, `git diff --check`, and
  `issuectl doctor --json`: pass.
- Real focused phases listed above pass, including 2 browser cases.

Review level: local adversarial review of the deletion boundary and shell
lifecycle, backed by destructive-operation regression tests. No product session,
contract, daemon state or authorization behavior changed. An optional independent
review attempt with `claude-fable-5-2` timed out after 600 seconds without any
response; it is **not counted as completed review**. There is no independent
finding assessment to claim. Full-gate verification remains the integrated
release operator's job, not evidence produced by this worker.

## Decisions for later review

- Clean release gates discard checkout-local caches; ordinary development gates
  retain them. Moving these caches to a new global store would preserve more
  download/build speed, but would introduce ownership, pruning and concurrent
  Playwright installation concerns. No new shared cache or sweeper was added.
- Keep the latest failed run's console/phase logs in the checkout's Git directory
  and retain Playwright failure output in place. Unlimited per-run evidence
  directories would recreate the accumulation problem. Operators can copy a
  failure before the next run when longer retention is needed.
- Cleanup is an allowlist, not `git clean -fdx` and not clone deletion. Tracked
  paths and symlinked output ancestors fail closed before deletion. Unrelated
  `.cache` contents and `.tools` remain the operator's property.
- Do not sweep global temporary directories to recover SIGKILL leftovers. The
  gate waits for its own background phases and handles INT/TERM; uncatchable
  termination still requires ownership-aware operator inspection.
