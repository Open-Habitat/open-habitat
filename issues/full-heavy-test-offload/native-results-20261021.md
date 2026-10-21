# Native test throughput — 2026-10-21

Target: the entire clean gate, with all checks, under 120 seconds on Alder.
**Not achieved. Issue remains open; worker is blocked, not a passing delivery.**

## Changes retained

- Native browser, lab, build, Storybook, focused Go and clean-gate entrypoints;
  removed the Fleetrepo dispatch adapter, declarations and dispatch-only tests.
- Go/Storybook starts alongside web checks, rather than after the web build.
  Each concurrent phase has four workers. Both browser configurations and
  packaging still run after heavy failures; failures prevent a passing receipt.
- One Vitest invocation covers the same 477 unique assertions instead of
  running 12 helper assertions twice through overlapping unit/component globs.
- Removed the extra unversioned Go binary build. Both reproducibility package
  builds still compile and execute the real product.
- Prefer cached npm downloads and omit the unrelated audit/funding requests.

## Measurements

Commands were run from this worktree, not the shared main checkout. Scripts
select native tools ahead of Fleetrepo's ordinary-command shims. All builds used
`TMPDIR=/var/tmp`. These are single runs under shared-host load, not a controlled
benchmark or evidence of a passing gate.

| Measurement | Baseline, 3fa9d5d3 | Experiment, 99e98f1c |
| --- | ---: | ---: |
| `/usr/bin/time -p ./scripts/ci-local.sh --clean --json` | **523.62 s, failed** | **908.80 s, failed** |
| Setup | 8 s | 6 s |
| Dependencies | 40 s | 16 s |
| Web checks and production build | 33 s | 31 s |
| Browser, normal then lab | 443 s; ordinary failed, lab not reached | 833 s; both failed |
| Go/Storybook/contracts (overlapping) | 347 s | 150 s |
| Storybook within Go phase | not separately timed | 8 s |
| Daemon race tests within Go phase | 279.097 s | 138.773 s |
| Native fixture | not reached | <1 s |
| Packaging, reproducibility and negative verification | not reached | 22 s, passed |
| Final checks | not reached | <1 s, passed; receipt withheld |

Fast web, measured separately without another test run:
`/usr/bin/time -p ./scripts/test-web-fast.sh`: baseline **25.38 s**, retained
configuration **22.83 s**, 81 files / 477 unique assertions passing. The earlier 6-second result was not reproduced; its cause is not established. jsdom setup is a large cost. Node/DOM project partitioning took
23.46 s and was discarded as complexity without a useful gain. VM-thread pooling
broke cross-realm assertions and was stopped/discarded, not accommodated by
weakening tests.

## Required failures and limits

Baseline ordinary browser: 272 passed / 27 failed / 3 skipped; lab and packaging
were not reached. Baseline Go had 12 failing top-level daemon tests, including
native writer census, continuation, held/resumed messages, clone observation and
workspace deletion. An existing same-UID nondumpable `gpg-agent` makes the real
writer census unknown. No household process was stopped or modified.

A private PID namespace made five sampled unchanged daemon tests pass in 2.11 s,
and improved the queued-send browser sample to 9/10, but **is not retained**:
rootless namespaces map the host root's file ownership to nobody.
`TestEditorDiscoversOperatorChanges` then failed because `/usr/bin/true` no longer
looked root-owned. This is a meaningful trust-boundary assertion, not a test to
skip. Commit 826311cd withdraws the namespace wrapper. The 908.80 s experiment
therefore is **not** a measurement of the final retained tree. The native editor
trust test passed separately after withdrawal (`go test -race -count=1
./internal/daemon -run '^TestEditorDiscoversOperatorChanges$'`, 1.98 s wall).

Experiment ordinary browser: 291 passed / 8 failed / 3 skipped. Failing specs:

- `browser-shell.spec.ts:90` — tab keyboard focus;
- `clone-page.spec.ts:193` — interrupted clone action timeout;
- `composer-geometry.spec.ts:27` — 390px dark editor value;
- `cross-workspace-agents.spec.ts:8` — action timeout;
- `local-files.spec.ts:61` — accessibility result;
- `provider-login-layout.spec.ts:10` — 1440px light visibility;
- `queued-send.spec.ts:171` — connection-state text during intentional slow start;
- `thread-fill.spec.ts:13` — geometry assertion.

Lab: 58 passed / 3 failed:
`lab-composer-area.spec.ts:106` (assertion), `:295` (focus), and
`lab-open-at-end.spec.ts:100` (reading anchor).

These have **not** been reproduced on an unmodified-main execution, so they are
not waived under the task's main-failure exception. Product and browser-test
source was unchanged, but that is not a substitute for reproduction. The known
`considerably-jagged-office` case was not among the experiment's failures.

At completion Alder reported load averages 13.28/20.18/18.05 and its 4 GiB swap
was full. This does not establish irreducible test cost. Browser failures,
shared-host observation interference and loaded-host throughput remain blockers;
no under-120-second or passing full-gate claim is justified. Required clean-gate
validation is incomplete for the final retained tree.

## Evidence

Full logs on Alder:

- `/var/tmp/oh-native-baseline.log`
- `/var/tmp/oh-native-final.log`
- `/var/tmp/oh-web-fast-baseline.log`
- `/var/tmp/oh-web-fast-kept.log`
- `/var/tmp/oh-browser-namespace.log`
- `/var/tmp/oh-bwrap-dev-check.log`
- `/var/tmp/oh-editor-restored.log`

Self-review, shell syntax, project-view validation and `git diff --check` passed.
No model review was requested or run. No application assertions were deleted or
weakened. No release/deployment was attempted.

## Rejected probes and command corrections

- Direct `unshare` could not create a UID map (operation not permitted); a
  Podman-assisted namespace admitted the non-root UID but initially failed
  ownership/runtime checks. Bubblewrap also initially lacked a usable
  `/dev/null`; `--dev /dev` plus private umask fixed the sampled checks, before
  the full gate exposed the root-ownership incompatibility above. All namespace
  changes were then withdrawn. `sudo -n true` confirmed no noninteractive root
  route; no privileged or host configuration change was attempted.
- Vitest node/DOM partitioning initially failed 11 assertions with `window`
  absent; declaring the six DOM-dependent helpers fixed that, but the gain did
  not justify the configuration. VM threads failed cross-realm assertions and
  were stopped; neither alternative is retained. The retained configuration
  passes all 477 unique assertions.
- An initial skill read used the wrong path (ENOENT), then the supplied skill
  path was read successfully. `command -v -a` was invalid in Bash and was
  replaced with `type -a`. Absent tool/config/fixture globs during discovery
  were corrected to the existing files. One `rg -E` probe used grep syntax and
  was replaced with the appropriate search. Biome invoked from the repository
  root rejected nested configuration; invoking it from `web/` passed. These
  were discovery mistakes, not skipped product checks.
- An unmodified-main source export was prepared at `/var/tmp/oh-native-main.*`
  for possible reproduction, but no main reproduction test was run. It carries
  no acceptance evidence. No subsidiary agent, service restart, model review,
  remote runner or deployment was launched.
