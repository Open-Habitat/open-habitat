# Testing

Small changes need fast feedback, while a gated release needs the full set of
checks. Run the checks that match the change while developing and before
landing; the full clean gate is not a landing precondition in this
development phase (Jari, 2026-10-13). Match each claim to evidence: browser
tests and unit tests alone cannot establish Linux user isolation.

All repository tests use synthetic homes, histories, identities and credentials.
Real homes, Pi history, SSH agents, browser profiles and the live host stay out
of these runs.

## Test value, not test count

A new test must make a plausible incorrect implementation fail while allowing a
correct refactor to pass. Prefer a failure/boundary case, an invariant, a past
regression, or a real interaction between components to a second transcription
of the implementation. Before adding a case, check whether an existing test
already proves the same behavior at the same boundary; extend it instead of
adding another journey. A test whose only assertion is that a supplied label
appears, a callback passes through a wrapper, a private CSS selector has an
exact value, or a source file contains a particular string needs a separate
reason to exist. Do not calculate the expected value with the code under test.

Each host-backed browser case starts an isolated host and Chromium page. Put
pure logic in the cheaper layer; reserve browser cases for actual browser or
host behavior (layout, focus, routing, concurrency, security boundaries).
Do not replace distinct-UID, gateway/daemon or native Pi evidence with a
same-UID browser mock. A literal value can be justified when it is an external
contract or an independently agreed design dimension, but duplicating current
CSS tokens is not such a contract. A screenshot written to disk is review
material, not a passing visual comparison assertion. When removing tests,
record what distinguishing failure they would have caught and where it is
still covered; do not claim elapsed-time savings without timing the changed
suite.

## Choose checks for the change

While editing, choose checks from the behavior and boundaries touched, not from a path-only or timestamp-based selector. A change to a shared auth, contract, test fixture or build dependency can affect several packages even if only one file changed. Install web dependencies with `npm ci --prefix web` when needed. `scripts/test-focused.sh` selects one area explicitly; it reports what it skips and **never writes a clean-gate receipt**. Use multiple runs when more than one boundary is touched. For shared fixtures, contracts, auth or build inputs choose the full gate instead. Examples:

```sh
./scripts/test-focused.sh --area web
./scripts/test-focused.sh --area browser --spec github-first-onboarding.spec.ts --tag @github-first
./scripts/test-focused.sh --area go --go-package ./internal/gateway
./scripts/test-focused.sh --area contracts
```

`test-web-fast.sh` checks pure client logic and rendering in seconds on an installed checkout (5.98 s versus 293.26 s for a warm full gate in the recorded single-run comparison; the gate also ran 92 browser cases). It does **not** run a browser, build production assets or check Go, generated contracts or packaging. For browser-facing changes, run the relevant Playwright specs or grep tags as well (and a11y for affected interactions); use `npm run test:browser --prefix web` when behavior crosses journeys or the affected specs are not clear. For Go changes, run the affected package tests and callers at the boundary; use the full gate when ownership/contract or release coverage is uncertain. The daemon's Pi credential, device, model and startup tests drive the pinned Pi SDK, so in a fresh worktree run `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` (as the gate does) before `go test ./internal/daemon`; without it they fail with "native Pi credentials unavailable" rather than skip.

Host-backed browser cases that exercise native credential writes also need that Pi SDK fixture package. Run those checks with `umask 077`: Pi’s SettingsManager creates its settings file using the process umask, and the daemon correctly refuses a group-writable file. A permissive developer-shell umask can therefore make a successful synthetic key save unreadable on the next request.

Do not reuse an earlier result after changing runnable code, fixtures, dependencies or packaged inputs. The fast command is feedback, not a substitute for the final clean gate.

Landing on `main` requires the checks that match the change: the fast web
checks and the affected Playwright specs for browser work, the affected Go
packages and the contracts drift check for host work, and the packaging step
when packaging inputs changed. Workers and worker briefs do not run the full
gate before merging. The full clean gate runs in three situations: when a
gated release is cut, when someone suspects a cross-cutting breakage, and
once per work round on `main` so its health is known. It is:

```sh
./scripts/ci-local.sh --clean --json
```

On Alder this command submits the complete **native ARM test-health** task to
Fleetrepo's shared runner (0.2 required), before local setup. It includes both
browser configs, web/Go checks, contracts and the native fixture, under the
runner's trusted per-job CPU/memory budget with parallel browser and Go phases.
Native amd64 packaging, reproducibility,
archive execution and socket validation still run on native amd64 CI; ARM
success is **not** a production release gate. Only the native gate writes the
production gate receipt. The remote task exports a separate
`.cache/arm-test-health/receipt.json`, explicitly scoped/platform-attributed,
with source cleanliness; the root runner receipt supplies authoritative captured
HEAD/tree/index/dirty identity. Fetches stay outside source. Dirty input is
supported without `--clean`; it cannot become clean evidence.

Run it from its own worktree, not the main checkout others merge into: it
formats Go sources in place, and leftover formatting edits in the main
checkout block every worker's `run merge`.

On native CI success, `--clean` writes `<git common dir>/open-habitat-gate-receipts/<HEAD tree>.json`.
That location is shared by linked worktrees, so main can reuse a worker's gate
result when the merged tree is identical. The receipt identifies the committed
tree and gate inputs it covers. On a repeat of the **same** committed tree,
the browser and Go/contracts phases can reuse the previous passed receipt's
results; the new receipt lists them under `reused_phases`. Every changed tree
runs both phases in full. The gated release preparer checks the receipt
against the current clean tree rather than rerunning the gate. Browser and Go/contracts run concurrently by default after the shared web build.
On a supported local gate host, for a scheduling experiment only, set `OH_GATE_SERIAL_HEAVY=1` to finish the
unchanged browser phase (normal then lab) before starting the unchanged
Go/contracts phase. Both phases still run and report separate logs/exit codes
if either fails; setup, web checks, packaging, receipt and reuse behavior do
not change. Unset or `0` keeps parallel scheduling; other values are rejected.
This opt-in has not been shown to be faster.
A changed-tree clean gate takes about three to six minutes, the browser phase
dominating (on 2026-10-18 under load: Go/contracts 242 s, the whole 359 s);
an identical tree reuses the passing receipt's phases in well under a minute.
A different commit with an identical tree can reuse it (the release
still pins and embeds its own commit SHA). A change to issue evidence, docs,
code, dependencies or package inputs changes the tree and requires a new clean
gate before a gated release. Receipts are local evidence, not signed attestations;
keep them on the machine where the gate ran. The gate prints its JSON envelope
on the final stdout line and the receipt path on stderr.

For the disposable test server, the normal Fleetrepo operator invocation is
`release_test.py --ungated --version <v> --output <new-dir>`. It requires a
clean, committed, pushed product tree but does not require the clean gate.
The output receipt and product `release-gate.json` say `gate: "ungated"` and
record the source tree. Omit `--ungated` when clean-gate evidence is needed:
the default refuses a missing or different-tree gate receipt and records
`gate: "clean-gate"` with the tree. A production release still requires the
clean gate; a test release does not, and neither does landing on `main`.

The Fleetrepo `infra/open-habitat-test/release_test.py` one-command operator
checks the receipt in gated mode, installs web dependencies from the
committed lockfile, prepares fresh web assets and binary,
verifies the package, then transfers and switches the test guest. Its dry run
stops before any guest transfer. It reports step/total timings and rejects a
live run above 100 seconds. Do not hand-edit prose receipts between steps.

On Alder, the opt-in `open-habitat-test-watch@N.service` watches clean, pushed
product `main` and serially deploys the newest commit as ungated pilot `N`,
then advances the pilot number. Start it only after the current guest release
has been verified and the Fleetrepo fleet unit `user/alder-open-habitat-watch`
is applied. **Stop it with** `systemctl --user stop
open-habitat-test-watch@N.service` (replace `N` with the number used to start
it). The watcher records a separate receipt for each superseded commit and
stops rather than retrying an ambiguous guest failure. It uses the full
release path even for web-only commits: the successor requires the binary's
embedded source to agree with the selected release. Fleetrepo's
`infra/open-habitat-test/RELEASE-UPGRADE.md` owns the full start, inspection
and recovery instructions.

Documentation-, issue- and evidence-only changes need relevant validators and
`git diff --check`; run `issuectl doctor --json` when issue metadata changes.
This includes `python3 scripts/validate-project-view.py` for project documentation.
Say which checks ran.

## Run the gate and browser tests

Run from the repository root with Go 1.27.1 and Node 22.23.2 on `PATH`.
If Go is missing, `./scripts/bootstrap-tools.sh` installs it locally and prints
the PATH export. The clean gate requires a committed tree with no untracked
files and checks cleanliness again at exit. Leave that worktree untouched
during the run; ignored build caches may remain.

The clean gate also runs the synthetic lab create→send→answer browser test against the real controller and fake Pi; `scripts/lab.sh` provides manual exploration.

Browser listeners default to lab 4175, Vite 4183 and demo 4184. The
parallel browser suite starts a fresh synthetic host for each case at its
worker's `OH_PORT_BASE + 20 + parallelIndex` (4194–4201 by default for eight
workers). Lab Playwright cases use four fresh lab-mode hosts at
`OH_PORT_BASE + 40 + parallelIndex`; manual lab remains at base + 1. A slot's
port is reused after its previous case ends. Each host has its own scenario,
clock, session and fake Pi state; tests in the same file can run concurrently
on separate hosts. On a shared-UID host near its inotify instance limit, set
`OH_BROWSER_WORKERS=2` for both suites; otherwise the default remains eight
browser workers and four lab workers. Set `OH_PORT_BASE` to a distinct value (e.g.
`OH_PORT_BASE=14000 ./scripts/ci-local.sh --clean --json`) to run another
worktree concurrently. `scripts/lab.sh start` selects a free port if its
preferred lab port is busy and records it in `.cache/lab/port` for `url` and
`web/lab/session.mjs`.

### Shared execution from ordinary commands

Heavy commands on Alder submit to the shared runner before local dependency checks:

```sh
npm run test:browser --prefix web                       # complete ordinary suite
npm run test:browser:lab --prefix web                   # complete lab config
./scripts/test-focused.sh --area browser --lab
./scripts/test-focused.sh --area browser --spec account-settings.spec.ts --tag @a11y
npm run build --prefix web
./scripts/test-focused.sh --area go                      # whole-module race checks
./scripts/ci-local.sh --clean --json
```

Fast checks run natively on every calling host, including Alder: `format:check`,
`lint`, `typecheck`, `test`, `test:unit`, `test:component`, `test-web-fast.sh`, and
focused web/contracts or explicit Go-package checks. Install their dependencies
locally first (`npm ci --prefix web` for web checks). The fast web script executes
the tool vectors directly, without an npm dispatcher, capture or placement probe.
Explicit Go-package checks run without race instrumentation; whole-module race
checks remain heavy. Capture/observer options such as `--writers-paused` and
`--job` apply only to heavy areas and are rejected for fast areas.

Heavy commands work from foreground sessions and Taskfleet worktrees.
`.hb-exec.json` declares browser, builds, Storybook, whole-module Go and gate
jobs. Inside a verified guest these execute locally without another queue
submission. Browser/Go jobs prepare the pinned Pi SDK fixture in their own unit;
the gate prepares both npm dependency sets once. The root runner supplies bounded
Go/compiler/browser parallelism, and the gate runs browser and Go phases
concurrently unless the explicit serial scheduling experiment is selected.
Unrelated Linux hosts retain native heavy execution and need their own
dependencies. Watch/dev/manual specialist commands are not remote dispatchers
and must not be used for heavy execution on Alder.

Invoking a foreground capture promises that the caller's cooperating source
writers remain paused until `Capture returned`. No remembered pause flag is
needed; `--writers-paused` remains accepted. For external churn use a closed
disposable copy. No global lock or atomicity against arbitrary writers is
claimed. Tracked final bytes, original Git HEAD/tree/index and dirty state are
captured by Fleetrepo; untracked selection defaults to none. Explicitly select
each new input with repeated `--untracked relative/path`, including new tests
(`--untracked web/tests/new.spec.ts`). Never select credentials or `.env*`.
No runner/admission/network failure falls back locally. A forged
`HB_EXEC_CONTEXT` on Alder cannot enable local work. Guest admission checks
Linux ARM64, hbjob/cgroup identity, `/j/src` and root-owned installed/task metadata.

The adapter prints the durable job ID before capture and retains raw responses
under a fresh `/var/tmp/oh-browser-*` directory outside source. Displayed
metadata/log tails are bounded. Fetch creates a new job-ID subdirectory there,
never extracts over source. Only terminal `success` passes; test-exit, OOM,
timeout, cancel, interruption, quota, unknown state, observer expiry and
transport errors are nonzero. Runner API exit zero does not mean tests passed.
`--wait-timeout N` bounds the observer (default 7500s), not the job. Reconnect
without recapturing or resubmitting, even after editing/removing a focused spec:

```sh
python3 scripts/browser-focused.py --task oh-browser-ordinary --job JOB_ID
fleetrepo-exec show JOB_ID --stale --json
fleetrepo-exec cancel JOB_ID --json
```

INT/TERM requests durable cancellation of that job; repeated signals are
ignored during acknowledgement. HUP/crash/session loss neither cancels nor
proves completion. Keep the printed ID; do not retry ambiguous capture with a
new key. `--idempotency-key KEY` identifies one logical attempt. The guest owns
deadlines and descendant cleanup. Remote ARM evidence is not distinct-UID or
native amd64 release proof.

For an exported Alder-consumable binary (not installation), run:

```sh
python3 scripts/browser-focused.py --task oh-build-amd64
```

This builds web assets and cross-builds pure Go with `GOOS=linux GOARCH=amd64
CGO_ENABLED=0`. Fetch exports `build-output/open-habitat-linux-amd64` with target
and actual ELF metadata outside source; it is not native amd64 execution proof.

Cheap dispatch/control-flow tests (no dependencies, compilers, browser or SSH):

```sh
TMPDIR=/var/tmp PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-browser-focused.py -v
```

The stubbed guest-gate case proves orchestration and failure preservation, not
application health. Actual full ordinary/lab/gate acceptance requires deployed
runner 0.2 and must retain real application failures.

For local specialist Playwright runs install Chromium at
`PLAYWRIGHT_BROWSERS_PATH`, normally `$HOME/.cache/ms-playwright` or a private
checkout cache. `OH_WEB_PREBUILT=1` belongs only to a gate that just built those
assets; standalone use can test stale output. Use `--no-reuse` on the native
clean gate when checking an identical tree for a suspected flake. The remote
ARM health task always runs phases in full, never reuses a native receipt.

### Browser host lifetime and stray cleanup

`python3 scripts/browser-hosts.py --json` reports same-UID synthetic hosts whose
worktree is gone or whose owner is init/systemd (including their synthetic Pi).
The gate runs this in report mode before setup. Add `--kill` to explicitly kill
reported processes; `--pid <pid>` restricts either operation to one process.
Live detached labs are owned by the shell that ran `scripts/lab.sh start`, not
its short-lived launcher: closing that shell ends the lab. All host binaries
watch their owner and worktree; synthetic Pi separately watches the host, even
when the host is killed with SIGKILL. These checks require Linux `/proc`;
cleanup uses Python's pidfd support to avoid signalling a reused PID.

Regression checks: `python3 scripts/test-browser-hosts.py`,
`go test ./test/browser-host`, and Playwright `tests/host-lifetime.spec.ts`.
The browser cases kill a launcher/host after the real controller starts a
synthetic Pi and require both processes to disappear within five seconds.

### Inspect Playwright traces

Record a trace for a focused run with Playwright's `--trace on` (including lab
runs with `--config web/playwright.lab.config.ts`). From the repository root:

```sh
./scripts/inspect-trace.sh web/test-results/<test>/trace.zip
./scripts/inspect-trace.sh --json web/test-results
```

The directory form requires exactly one `trace.zip`; pass a specific archive
when several tests produced traces. The script extracts into a fresh private
`oh-trace.*` directory under `$TMPDIR` (Linux default `/var/tmp`, disk-backed
storage required), prints its path, a bounded summary of failed actions,
console/page errors and recent network failures, and a local viewer command.
It requires Python 3 and `mktemp` (plus `stat` on Linux), never launches a viewer
or deletes files, and leaves both the archive and extracted files intact.
Treat traces as sensitive: inspect synthetic traces here, not live user data.

## Component catalog and visual checks

Storybook uses the same production components as the application. Open it
with `npm run storybook --prefix web -- --no-open` after `npm ci --prefix web`,
or build it with `npm run build-storybook --prefix web`; the toolbar switches
between light and dark. Stories show presentation states with synthetic data
and do not simulate session binding, routing or Pi receipts.
`storybook:test` builds the catalog. Its interactive accessibility addon
shows Axe findings, while `test:a11y` runs browser assertions against the
production preview fixtures. `test:visual` opts into the light/dark catalog
screenshots for human comparison; those two capture-only cases are skipped by
the normal browser gate. The unhappy-state and focus/zoom checks still run in
the gate because they assert behavior. A captured image is not an automated
visual comparison.

Compare the design drafts and production side by side in the synthetic lab;
correct differences in shared components and tokens. The comparison fixture
shows at least one running conversation with tool rows and two queued messages,
one answered conversation and one read-only conversation, with no duplicates.
This gives the comparison distinct, recognisable design states.

```sh
npm run test:component --prefix web
npm run storybook:test --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:visual --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:a11y --prefix web
```

## Understand the result

The gate checks Go and web code, browser behavior, generated contracts,
documentation, fixtures and release packaging, including reproducibility and
archive validation. [The script](scripts/ci-local.sh) defines the full set of
checks and its cache reuse.

Its VM `self-test` validates the recipe offline without booting a guest.
The browser host uses same-UID sockets. Claims about distinct kernel UIDs,
systemd or first-login provisioning therefore need additional scenarios:

| Claim | Additional synthetic check |
| --- | --- |
| Host-wide procfs isolation, own-UID trash/Pi scans, process tray/Taskfleet contracts and Ubuntu polkit process subjects | `./scripts/test-proc-hidepid-uids.sh` (private rootless PID/mount namespace; not installed-host boot/logind-session evidence) |
| Systemd socket fixture | `./scripts/vm-test.sh systemd-self-test --json` |
| Two precreated user routes | `./scripts/vm-test.sh two-user-routing --json` |
| Root broker / first-login account creation | `./scripts/vm-test.sh <scenario> --json`: choose `broker-guest`, `jit-provision`, `jit-login` or `jit-concurrent`; the last needs a clean committed release tree |
| Native gh catalog with separate kernel UIDs | `./scripts/test-repo-catalog-uids.sh` |
| Fixed-path shared Pi selector with distinct UIDs | `./scripts/test-shared-pi-selector.sh` |
| Pi attempt and integration account peer/UID/socket denials | `./scripts/test-pi-attempt-uids.sh` |
| Browser shell runs as its person in the workspace, cannot reach another person's home, daemon or tmux server, and outlives its connection | `./scripts/test-terminal-uids.sh` |
| Broker boot start of syncing people's daemons by their own signal only, and linger targets under distinct UIDs (loginctl mocked) | `./scripts/test-broker-boot-uids.sh` |
| Real pinned Pi controller under mapped UIDs | `./scripts/test-real-pi-controller.sh` (cached image/archives required) |

Guest scenarios need rootless Podman and a cached or downloadable image.
A change to a scenario states its claim and limits in the result of the
issue that makes it. These synthetic runs do not establish real
provider behavior or live-server isolation. Fleetrepo's deployment preflight
and receipts record the live-host evidence.

Record commands, tested revision/tree, outcomes and unverified behavior in the
issue's result. A missing prerequisite means not run; an infrastructure problem
that interrupts the gate means blocked. Record the cause and retry after it
is resolved. A partial run is not a pass.

Inspect skips before claiming coverage: `go test -v` exposes ACL/root/UID cases
skipped on an ordinary developer machine. For visual changes, include
proportionate screenshots and identify whether they show a synthetic or live
environment.

Visual evidence belongs in the issue folder as adjacent screenshot and static
HTML from the synthetic lab (`web/lab/session.mjs` `snapshot`); never use live data.
