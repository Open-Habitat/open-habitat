# Testing

This is the repository's testing policy and command guide. The exact implementation of the full gate is `scripts/ci-local.sh`; an issue's result records what was actually run, at which revision, and what remains unverified. Keep tests synthetic: no real home, Pi history, SSH agent, browser profile, credentials or live host.

## Choose the smallest useful proof

- While editing, run focused tests for the changed behavior and its closest boundaries. Examples: `go test ./internal/gateway -run TestOAuth -count=1`, `npm run test:component --prefix web`, `npm run test:e2e --prefix web -- --grep @github-first`, or `python3 scripts/validate-project-view.py`. Add a two-UID container or VM scenario when kernel UID/systemd behavior is the claim: a Go unit test cannot prove it.
- Before landing a change to runtime, browser behavior, contracts, dependencies, release/package templates, tests or the gate itself, commit the candidate and run `./scripts/ci-local.sh --clean --json` once on that exact tree. Do not run it before review and again afterwards unless the review changed the candidate. A previous pass covers the same tree even if the commit message is later stamped; a new code/config/test tree needs a new pass.
- For documentation-, issue- or evidence-only changes that do not change runnable checks or packaged inputs, run the relevant validator(s), `issuectl doctor --json` when issue metadata changed, and `git diff --check`. State that the full gate was not rerun. Do not use this exception for changes to `scripts/`, `test/`, web assets, systemd templates or dependencies. A release still needs a full gate on the exact product tree it ships.
- If an external dependency fetch, occupied Playwright port, or unavailable tool stops the gate, report it as **blocked**, not passed. Retry only after the cause is resolved; do not count a partial run as green. Record the command, revision, failure and subsequent result without running a second successful gate for the same tree.

Run the gate from the repository root with Go 1.27.1 and Node 22.23.2 on `PATH`. If Go is missing, `./scripts/bootstrap-tools.sh` prints a repository-local PATH export. The gate uses `/var/tmp` for disk-backed scratch; it refuses dirty trees, including untracked files, both before and after the run. Leave that worktree untouched while it runs. It does not require an empty gitignored `.cache/` or `dist/`. Different worktrees can build in parallel, but Playwright uses fixed ports 4183 and 4174: do not run their browser suites simultaneously. Do not kill another worker's server to free the ports.

Use `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"` for standalone browser runs. `npm ci --prefix web` installs the locked web graph; `npm install` changes the lock. A standalone `npm run test:browser --prefix web` runs all E2E and a11y cases and builds its own production assets. `test:e2e` and `test:a11y` remain available for focused diagnosis. `NAH_WEB_PREBUILT=1` is **only** for the gate after its own fresh `npm run build --prefix web`; setting it on a standalone run can serve stale assets. The standalone test host is synthetic and uses one Playwright worker because its scenario switch is process-wide.

## What a green gate proves

The gate checks pinned issuectl and Pi helper, Go fmt/vet/race/build, web format/lint/typecheck/unit/component, all Playwright E2E and a11y cases in one host startup, production build and fixture-leak scan, Storybook, generated contract drift, plan/docs/license checks, native fixtures, issue doctor and clean-tree status. It reinstalls web dependencies offline after a locked online fetch, makes two byte-identical release archives, verifies original and relocated archives, and rejects tampered and unsafe archives. Phase durations print to stderr for comparing repeated runs on the same machine/revision; a warm `.cache/ci-local/` holds only disposable, content-addressed Go and npm build/download caches. HOME, Python venv and the pinned issuectl executable are still private to each invocation. Delete `.cache/ci-local/` to measure cold-cache behavior.

The gate runs `./scripts/vm-test.sh self-test --json`, which checks the **recipe offline and boots no guest**. It does not prove distinct kernel UIDs, systemd, first login, real provider behavior or the live host. For those claims, select an explicit scenario and record its limits:

| Claim | Additional synthetic proof |
| --- | --- |
| Systemd socket fixture | `./scripts/vm-test.sh systemd-self-test --json` |
| Two precreated user routes | `./scripts/vm-test.sh two-user-routing --json` |
| Root broker / first-login account creation | `./scripts/vm-test.sh broker-guest --json`, `jit-provision`, `jit-login` or `jit-concurrent` as relevant; `jit-concurrent` needs a clean committed release tree |
| Native gh catalog with separate kernel UIDs | `./scripts/test-repo-catalog-uids.sh` |
| Fixed-path shared Pi selector with distinct UIDs | `./scripts/test-shared-pi-selector.sh` |
| Pi attempt peer/UID/socket denials | `./scripts/test-pi-attempt-uids.sh` |
| Real pinned Pi controller under mapped UIDs | `./scripts/test-real-pi-controller.sh` (cached image/archives required) |

The guest scenarios need rootless Podman and a cached/downloadable image and take minutes. A missing prerequisite means *not run*, never *passed*. `jit-reboot-diagnostic` has not produced a passing proof. The synthetic browser host uses same-UID sockets, so it cannot stand in for a two-UID guest. None of these scenarios proves isolation on the live test server: Fleetrepo's deployment preflight and receipts own that claim. See `issues/prove-jit-guest-isolation/` for the guest proof ledger and `issues/build-agent-control/result.md` for the Pi controller's limits.

Record the tested revision/tree, focused checks, the one final gate result (or reason not run), opt-in scenario outcomes, and any skipped tests. `go test` can skip ACL/root/UID cases on an ordinary developer machine; use `-v` to see the skips before claiming coverage. For a frontend visual change, leave proportionate screenshots; a synthetic screenshot is not a live acceptance test.
