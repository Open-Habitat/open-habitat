# Testing

Small changes need fast feedback, while a gated release needs the full set of
checks. Run the checks that match the change while developing and before
landing; the full clean gate is not a landing precondition in this
development phase (Jari, 2026-10-13). Match each claim to evidence: browser
tests and unit tests alone cannot establish Linux user isolation.

All repository tests use synthetic homes, histories, identities and credentials.
Real homes, Pi history, SSH agents, browser profiles and the live host stay out
of these runs.

## Choose checks for the change

While editing, choose checks from the behavior and boundaries touched, not from a path-only or timestamp-based selector. A change to a shared auth, contract, test fixture or build dependency can affect several packages even if only one file changed. Install web dependencies with `npm ci --prefix web` when needed. Examples:

```sh
./scripts/test-web-fast.sh                         # web formatting, lint, types, unit + component
npm run test:e2e --prefix web -- --grep @github-first # targeted host-backed browser journey
go test ./internal/gateway -run TestOAuth -count=1
```

`test-web-fast.sh` checks pure client logic and rendering in seconds on an installed checkout (5.98 s versus 293.26 s for a warm full gate in the recorded single-run comparison; the gate also ran 92 browser cases). It does **not** run a browser, build production assets or check Go, generated contracts or packaging. For browser-facing changes, run the relevant Playwright specs or grep tags as well (and a11y for affected interactions); use `npm run test:browser --prefix web` when behavior crosses journeys or the affected specs are not clear. For Go changes, run the affected package tests and callers at the boundary; use the full gate when ownership/contract or release coverage is uncertain. Do not reuse an earlier result after changing runnable code, fixtures, dependencies or packaged inputs. The fast command is feedback, not a substitute for the final clean gate.

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

On success, `--clean` writes `<git common dir>/open-habitat-gate-receipts/<HEAD tree>.json`.
That location is shared by linked worktrees, so main can reuse a worker's gate
result when the merged tree is identical. The receipt identifies the committed
tree and gate inputs it covers; the release
preparer checks it against the current clean tree rather than rerunning the
11-minute gate. A different commit with identical tree can reuse it (the
release still pins and embeds its own commit SHA). A change to issue evidence,
docs, code, dependencies or package inputs changes the tree and requires a new
clean gate before release. Receipts are local evidence, not signed attestations;
keep them on the machine where the gate ran. The gate prints its JSON envelope
on the final stdout line and the receipt path on stderr.

For the disposable test server, the normal Fleetrepo operator invocation is
`release_test.py --ungated --version <v> --output <new-dir>`. It requires a
clean, committed, pushed product tree but does not require the clean gate.
The output receipt and product `release-gate.json` say `gate: "ungated"` and
record the source tree. Omit `--ungated` when clean-gate evidence is needed:
the default refuses a missing or different-tree gate receipt and records
`gate: "clean-gate"` with the tree. A production release still requires the
clean gate. The clean gate remains the health check for main and should be run
on a final implementation candidate even when deploying ungated to test.

The Fleetrepo `infra/open-habitat-test/release_test.py` one-command operator
checks the receipt in gated mode, installs web dependencies from the
committed lockfile, prepares fresh web assets and binary,
verifies the package, then transfers and switches the test guest. Its dry run
stops before any guest transfer. It reports step/total timings and rejects a
live run above 100 seconds. Do not hand-edit prose receipts between steps.

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

Browser listeners default to host 4174, lab 4175, Vite 4183 and demo 4184; set `OH_PORT_BASE` to a distinct value (e.g. `OH_PORT_BASE=14000 ./scripts/ci-local.sh --clean --json`) to run another worktree concurrently. `scripts/lab.sh start` selects a free port if its preferred lab port is busy and records it in `.cache/lab/port` for `url` and `web/lab/session.mjs`; for standalone browser checks:

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
using it standalone can test stale output. Keep one Playwright worker because
the synthetic host's scenario switch is shared across tests.

## Component catalog and visual checks

Storybook uses the same production components as the application; the
[component map](design-system/components.md) explains how to open it.
`storybook:test` builds the catalog. Its interactive accessibility addon
shows Axe findings, while `test:a11y` runs browser assertions against the
production preview fixtures. Visual captures complement behavioral assertions.

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
checks; [the performance report](issues/speed-up-clean-ci/result.md) explains
cache reuse and timing.

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
| Pi attempt peer/UID/socket denials | `./scripts/test-pi-attempt-uids.sh` |
| Real pinned Pi controller under mapped UIDs | `./scripts/test-real-pi-controller.sh` (cached image/archives required) |

Guest scenarios need rootless Podman and a cached or downloadable image.
See the [guest proof ledger](issues/prove-jit-guest-isolation/result.md) and
[Pi controller results](issues/build-agent-control/result.md) for established
coverage and remaining gaps. These synthetic runs do not establish real
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
