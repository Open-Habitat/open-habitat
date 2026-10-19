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

`test-web-fast.sh` checks pure client logic and rendering in seconds on an installed checkout (5.98 s versus 293.26 s for a warm full gate in the recorded single-run comparison; the gate also ran 92 browser cases). It does **not** run a browser, build production assets or check Go, generated contracts or packaging. For browser-facing changes, run the relevant Playwright specs or grep tags as well (and a11y for affected interactions); use `npm run test:browser --prefix web` when behavior crosses journeys or the affected specs are not clear. For Go changes, run the affected package tests and callers at the boundary; use the full gate when ownership/contract or release coverage is uncertain. The daemon's Pi credential, device, model and startup tests drive the pinned Pi SDK, so in a fresh worktree run `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` (as the gate does) before `go test ./internal/daemon`; without it they fail with "native Pi credentials unavailable" rather than skip. Do not reuse an earlier result after changing runnable code, fixtures, dependencies or packaged inputs. The fast command is feedback, not a substitute for the final clean gate.

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

Run it from its own worktree, not the main checkout others merge into: it
formats Go sources in place, and leftover formatting edits in the main
checkout block every worker's `run merge`.

On success, `--clean` writes `<git common dir>/open-habitat-gate-receipts/<HEAD tree>.json`.
That location is shared by linked worktrees, so main can reuse a worker's gate
result when the merged tree is identical. The receipt identifies the committed
tree and gate inputs it covers. On a repeat of the **same** committed tree,
the browser and Go/contracts phases can reuse the previous passed receipt's
results; the new receipt lists them under `reused_phases`. Every changed tree
runs both phases in full. The gated release preparer checks the receipt
against the current clean tree rather than rerunning the gate. Browser and Go/contracts run concurrently by default after the shared web build.
For a scheduling experiment only, set `OH_GATE_SERIAL_HEAVY=1` to finish the
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
`web/lab/session.mjs`; for standalone browser checks:

```sh
npm ci --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:browser --prefix web
```

This runs all E2E and accessibility cases and builds fresh production assets.
Use the same browser path for focused `test:e2e` or `test:a11y` runs.
A fresh worktree has an empty `.cache/ms-playwright`, so every browser case
then fails to launch; install Chromium there or point
`PLAYWRIGHT_BROWSERS_PATH` at an existing cache such as `$HOME/.cache/ms-playwright`.
`OH_WEB_PREBUILT=1` belongs only to the gate, which has just built those assets;
using it standalone can test stale output. The lab inventory capture script
still uses its single manual lab host and must not share it with other captures.
Use `--no-reuse` on the clean gate when rechecking an identical tree for a
suspected flake; otherwise the browser and Go/contracts results are reused from
the previous passed receipt. The gate JSON reports `reused_phases` explicitly.

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
| Systemd socket fixture | `./scripts/vm-test.sh systemd-self-test --json` |
| Two precreated user routes | `./scripts/vm-test.sh two-user-routing --json` |
| Root broker / first-login account creation | `./scripts/vm-test.sh <scenario> --json`: choose `broker-guest`, `jit-provision`, `jit-login` or `jit-concurrent`; the last needs a clean committed release tree |
| Native gh catalog with separate kernel UIDs | `./scripts/test-repo-catalog-uids.sh` |
| Fixed-path shared Pi selector with distinct UIDs | `./scripts/test-shared-pi-selector.sh` |
| Pi attempt and integration account peer/UID/socket denials | `./scripts/test-pi-attempt-uids.sh` |
| Broker boot start of syncing people's daemons by their own signal only | `./scripts/test-broker-boot-uids.sh` |
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
