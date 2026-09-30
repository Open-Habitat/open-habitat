# Testing

Small changes need fast feedback, while releases need the full set of checks.
Run focused tests during development and the full clean gate on the final
implementation. Match each claim to evidence: browser tests and unit tests
alone cannot establish Linux user isolation.

All repository tests use synthetic homes, histories, identities and credentials.
Real homes, Pi history, SSH agents, browser profiles and the live host stay out
of these runs.

## Choose checks for the change

While editing, test the changed behavior and its closest boundaries. For example:

```sh
go test ./internal/gateway -run TestOAuth -count=1
npm run test:component --prefix web
npm run test:e2e --prefix web -- --grep @github-first
```

Before landing runtime, browser, contract, dependency, package, test or gate
changes, commit the final candidate and run:

```sh
./scripts/ci-local.sh --clean --json
```

A successful run covers the same implementation even if the commit message or
evidence text later changes. Reuse that result; rerun when the implementation
changes or there is a reason, such as investigating intermittent failures.
A release needs a full pass on the exact product tree it ships.

Documentation-, issue- and evidence-only changes need relevant validators and
`git diff --check`; run `issuectl doctor --json` when issue metadata changes.
This includes `python3 scripts/validate-project-view.py` for project documentation.
State that the full gate was not rerun. This exception applies only when
runnable checks and packaged inputs are unchanged.

## Run the gate and browser tests

Run from the repository root with Go 1.27.1 and Node 22.23.2 on `PATH`.
If Go is missing, `./scripts/bootstrap-tools.sh` installs it locally and prints
the PATH export. The clean gate requires a committed tree with no untracked
files and checks cleanliness again at exit. Leave that worktree untouched
during the run; ignored build caches may remain.

The clean gate also runs the synthetic lab create→send→answer browser test against the real controller and fake Pi; `scripts/lab.sh` provides manual exploration.

Browser listeners default to host 4174, lab 4175, Vite 4183 and demo 4184; set `NAH_PORT_BASE` to a distinct value (e.g. `NAH_PORT_BASE=14000 ./scripts/ci-local.sh --clean --json`) to run another worktree concurrently. `scripts/lab.sh start` selects a free port if its preferred lab port is busy and records it in `.cache/lab/port` for `url` and `web/lab/session.mjs`; for standalone browser checks:

```sh
npm ci --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:browser --prefix web
```

This runs all E2E and accessibility cases and builds fresh production assets.
Use the same browser path for focused `test:e2e` or `test:a11y` runs.
`NAH_WEB_PREBUILT=1` belongs only to the gate, which has just built those assets;
using it standalone can test stale output. Keep one Playwright worker because
the synthetic host's scenario switch is shared across tests.

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
