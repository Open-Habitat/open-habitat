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

UI wording is not tested (Jari, 2026-10-21). Copy changes freely, and a test
that breaks when a label or sentence is reworded proves nothing about behavior.
Find elements by role and a stable `data-testid`, not by their visible text or
accessible name, and do not assert what text says. Accessible names are checked
for existence by the axe audits, not for their wording. Text is asserted only
when it is itself the contract: for example that an error does not leak
provider or another user's data, or that native content (a file name, a
message the person wrote) is shown unchanged.

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

Specs wait for the state they assert, hold fixture transitions they depend on,
and drive product timers with `page.clock` rather than racing wall time. Use
reduced motion for axe and screenshots unless motion itself is being tested.
Ordering tests belong in Vitest where possible: `web/src/test/controlledTransport.ts`
steps replies and events explicitly; its example tests both delivery orders.

### Periodic ordering detector (not a gate)

Run `bash scripts/browser-stress.sh` periodically, not alongside another whole
suite. It holds the suite lock across both suites, uses CPU 4×, reply jitter
0–250 ms, default test/expect budgets ×4 and two repeats. Explicit per-spec
budgets remain explicit. Pass a grep expression to smoke-test a small subset
in both suites. `OH_PORT_BASE=11000` reserves ordinary ports, with lab at +100.
`OH_REPLY_SEED` is printed and can be supplied to replay the delay schedule;
it cannot reproduce OS scheduling or identical browser interleavings.

Focused runs with `--spec` or `--tag` default to 0–60 ms reply jitter.
`OH_REPLY_DELAY_MS=0` disables it; use `OH_REPLY_DELAY_MS=250
OH_REPLY_SEED=my-seed` for the stronger detector. Each failing case prints
its seed. Verify changed specs with `--repeat-each 3` through Playwright
and a small `OH_BROWSER_WORKERS`; whole suites do not inherit the focused
runner's default. The synthetic host
uses a seeded per-method/path sequence before API dispatch, matching the sweep;
fixture controls and the event stream are not delayed. Independent request
waits permit overtaking; controlled Vitest delivery covers exact event/reply
orders without reordering the production journal itself. CPU throttling covers
the fixture page and pages opened with `context.newPage`, not browser popups.

## Choose checks for the change

While editing, choose checks from the behavior and boundaries touched, not from a path-only or timestamp-based selector. A change to a shared auth, contract, test fixture or build dependency can affect several packages even if only one file changed. Install web dependencies with `npm ci --prefix web` when needed. `scripts/test-focused.sh` selects one area explicitly; it reports what it skips and **never writes a clean-gate receipt**. Use multiple runs when more than one boundary is touched. For shared fixtures, contracts, auth or build inputs choose the full gate instead. Examples:

```sh
./scripts/test-focused.sh --area web
./scripts/test-focused.sh --area browser --spec github-first-onboarding.spec.ts --tag @github-first
./scripts/test-focused.sh --area browser --spec github-first-onboarding.spec.ts --spec host-lifetime.spec.ts
./scripts/test-focused.sh --area go --go-package ./internal/gateway
./scripts/test-focused.sh --area contracts
```

Repeat `--spec` to select several files; every name is validated before any run.
Ordinary and lab specs use separate configurations when combined; a failure in
one group does not skip the other. `--tag` filters all selected files.
`python3 scripts/test-test-focused.py` checks selection, validation and exit
status through the shell entrypoint with a fake `npx`, without launching browsers.

`test-web-fast.sh` checks pure client logic and rendering on an installed checkout. It does **not** run a browser, build production assets or check Go, generated contracts or packaging. For browser-facing changes, run the relevant Playwright specs or grep tags as well (and a11y for affected interactions); use `npm run test:browser --prefix web` when behavior crosses journeys or the affected specs are not clear. For Go changes, run the affected package tests and callers at the boundary; use the full gate when ownership/contract or release coverage is uncertain. Go tests need two things a host does not supply, and `test-focused.sh --area go` prepares both as the gate does. The daemon's Pi credential, device, model and startup tests drive the pinned Pi SDK; the focused entry runs `npm ci` in `internal/daemon/pi-device-test` when it is missing or older than its lockfile, and without it a direct `go test ./internal/daemon` fails with "native Pi credentials unavailable" rather than skip. Daemon and host schema tests run `scripts/validate-contracts.py` with `$PYTHON`, which must have `requirements-ci.txt` installed. The focused `go` and `contracts` areas use a caller's `$PYTHON` or a venv built from those pins, cached under the git common directory (`oh-ci-python/`) and shared by worktrees. A direct `go test` without such a `$PYTHON` fails those tests with that hint, not with a bare `ModuleNotFoundError`.

`go test ./internal/host -run TestSiteSchemaDrift` compares shipped site-schema
acceptance with the Go reader for field presence/types, numeric boundaries and
editor templates. It uses the same `$PYTHON` as the schema tests;
the ordinary Go gate runs it and fails on drift. Additional cross-field host
constraints remain runtime checks, not installation evidence.

`./scripts/test-proc-remount.sh` runs the rendered numeric-GID proc unit command
twice in a disposable rootless Podman mount/user namespace using the local
Ubuntu 24.04 image. It catches util-linux name conversion differences on a
repeat remount; it neither changes the host proc mount nor qualifies systemd,
quota, a VM or a customer installation. Ordinary host tests cover an already
prepared host changing runtime targets and synthetic `session_restarting`
continuation/refusal evidence; native quota cleanup readback remains a kernel
boundary, not something a synthetic journal proves.

Host-backed browser runs need that Pi SDK fixture package too: the synthetic host reads credentials and recap settings through it, and without it unrelated cases fail on "unknown" credentials or unsaved settings, so browser global setup refuses to start. Run those checks with `umask 077`: Pi’s SettingsManager creates its settings file using the process umask, and the daemon correctly refuses a group-writable file. A permissive developer-shell umask can therefore make a successful synthetic key save unreadable on the next request.

Do not reuse an earlier result after changing runnable code, fixtures, dependencies or packaged inputs. The fast command is feedback, not a substitute for the final clean gate.

A whole browser suite runs one at a time per host. Each one starts its own
Chromes and synthetic hosts and is mostly Chromium CPU: the ordinary and lab
suites side by side take about 5½ minutes on an idle 8-core machine and leave
about a fifth of it idle, so a second whole run would saturate it, slow every
other worker and anything else the machine serves, and make timing-sensitive
cases fail. `scripts/test-focused.sh --area browser` and `browser-focused.py`
without `--spec` or `--tag` (including `npm run test:browser` and
`test:browser:lab`), and the gate's browser phase, therefore run under
`scripts/browser-suite-lock.py`: an flock on
`/var/tmp/open-habitat-browser-suite.lock` that waits for the other run and says
which worktree holds it. The kernel releases the lock when the holder dies, so
a killed run never blocks the next. Runs of named specs or tags take no lock.
Bare `npx playwright test` bypasses it, so use the scripts for whole suites.
`OH_BROWSER_SUITE_LOCK` names a different lock file, for testing the lock.

Landing on `main` requires the checks that match the change: the fast web
checks and the affected Playwright specs for browser work, the affected Go
packages and the contracts drift check for host work, and the packaging step
when packaging inputs changed. Workers and worker briefs do not run the full
gate or a whole browser suite before merging, unless the change crosses
every browser journey; the whole suite runs once on integrated `main`. The full clean gate runs in three situations: when a
gated release is cut, when someone suspects a cross-cutting breakage, and
once per work round on `main` so its health is known. It is:

```sh
./scripts/ci-local.sh --clean --json
```

Tests use ordinary commands (`npm`, `go`, `npx playwright test`) and run
natively by default. These scripts never choose another machine for them;
placing a suite elsewhere is the business of the machine's own tooling.

Run it from its own worktree, not the main checkout others merge into: it
formats Go sources in place, and leftover formatting edits in the main
checkout block every worker's `run merge`.

On native CI success, `--clean` writes `<git common dir>/open-habitat-gate-receipts/<HEAD tree>.json`.
That location is shared by linked worktrees, so main can reuse a worker's gate
result when the merged tree is identical. The receipt identifies the committed
tree and gate inputs it covers. On a repeat of the **same** committed tree,
the browser and Go/contracts phases can reuse the previous passed receipt's
results; the new receipt lists them under `reused_phases`. Every changed tree
runs both phases in full. A release uses the receipt rather than rerunning the
gate: `scripts/prepare-release.sh --gate clean-gate` refuses a receipt that
does not cover exactly the commit's tree, before and again after the build. Go/contracts
and Storybook overlap the web checks/build; browser runs after the fresh web
build. The ordinary and lab suites run side by side under one hold of the
suite lock, with `OH_BROWSER_WORKERS` (default 6) and `OH_LAB_WORKERS`
(default 3) workers; the lab suite listens at `OH_PORT_BASE + 100`, because
ordinary specs start lab-mode hosts too. The suites run at nice 5 so the Go
tests beside them, which mostly wait on subprocesses, are not starved, and
without traces, which cost about a quarter of the suite's CPU; rerun a failed
spec with `--trace on`. Go and web checks default to four workers. Both
browser configurations run to the end even when one fails, and failed heavy
checks never write a passing receipt. Packaging and the native fixture run in
the background beside the browser and Go phase; `go fmt`, `go generate` and the
generated-contract check run before anything reads the tree beside them. On an
idle 8-core machine the gate takes about 6½–7 minutes, almost all of it the
six-minute browser, Go and packaging phase.
A different commit with an identical tree can reuse it (the release
still pins and embeds its own commit SHA). A change to issue evidence, docs,
code, dependencies or package inputs changes the tree and requires a new clean
gate before a gated release. Receipts are local evidence, not signed attestations;
keep them on the machine where the gate ran. The gate prints its JSON envelope
on the final stdout line and the receipt path on stderr.

`scripts/prepare-release.sh` prepares a release package from a clean,
committed tree that is pushed to the explicitly named remote branch. With
`--gate ungated` it does not require the clean gate; the package's
`release-gate.json` says `gate: "ungated"` and records the source tree. With
`--gate clean-gate` it refuses a missing or different-tree gate receipt and
records `gate: "clean-gate"` with the tree. A production release requires the
clean gate; a disposable test release does not, and neither does landing on
`main`. `python3 scripts/test-prepare-release.py` checks the preparer with
synthetic Git origins and build commands, not a live build; the preparer has
no dry-run mode.

For a test release with its own runtime, add
`--runtime-cache /var/tmp/agent-scratch/oh-runtime-cache`. Hold the scratch
lease for the entire preparation (`flock --shared /var/tmp/agent-scratch/.lease`)
and put `TMPDIR` in a task-specific scratch directory. The option writes
`OUTPUT/runtime/{core.tar.gz,integrations.tar.gz,release.json}` alongside the
product package, with the requested version and source commit. The cache is
local, disposable build output, keyed by runtime input content and architecture;
it may be deleted when not in use. Keep it writable only by the trusted builder;
transfer entries only from a trusted builder (the cache key is not a signature).
Product-only commits reuse archive bytes,
not the old manifest. Every use passes the current product's closure verifier.
A corrupt or no-longer-accepted cache fails closed: remove that entry and retry
on a native builder. Cache misses require a native Linux host of the requested
target architecture and the runtime builders' Go/Podman/network prerequisites.
For the other architecture, transfer the matching cache entry from a native
builder; without it preparation fails, rather than emulating or omitting runtime.
This is the required core/integrations closure, not optional profiles or an
upgrade descriptor. It does not install or activate anything.
`python3 scripts/test-prepare-release-closure.py` checks content invalidation,
fresh manifest identity, verifier invocation, failed-cache publication and
non-native cache handling with synthetic builders; it does not prove a real
runtime build or installation.

Documentation-, issue- and evidence-only changes need relevant validators and
`git diff --check`; run `issuectl doctor --json` when issue metadata changes.
This includes `python3 scripts/validate-project-view.py` for project documentation.
`python3 scripts/test-project-scripts.py`
checks standalone public validation, explicit pruning references and archive
lookup in disposable repositories, without building the product.
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
`OH_PORT_BASE + 40 + parallelIndex`; manual lab remains at base + 1. The lab
config writes `web/test-results-lab`, so it can run beside the ordinary suite,
which clears `web/test-results` when it starts. A slot's
port is reused after its previous case ends. Each host has its own scenario,
clock, session and fake Pi state; tests in the same file can run concurrently
on separate hosts. On a shared-UID host near its inotify instance limit, set
`OH_BROWSER_WORKERS=2` for both suites; otherwise the default remains eight
browser workers and four lab workers. Set `OH_PORT_BASE` to a distinct value (e.g.
`OH_PORT_BASE=14000 ./scripts/ci-local.sh --clean --json`) to run another
worktree concurrently. `scripts/lab.sh start` selects a free port if its
preferred lab port is busy and records it in `.cache/lab/port` for `url` and
`web/lab/session.mjs`.

### Ordinary commands

Install web and Pi SDK fixture dependencies before standalone native checks.
For Playwright install Chromium at `PLAYWRIGHT_BROWSERS_PATH`, normally
`$HOME/.cache/ms-playwright` or a private checkout cache.
`OH_WEB_PREBUILT=1` belongs only to a gate that just built those assets;
standalone use can test stale output. Use `--no-reuse` on the clean gate
when checking an identical tree for a suspected flake.

### Scratch directories

`ci-local.sh`, `test-focused.sh`, `browser-focused.py` and
`browser-stress.sh` give their test children a private disk-backed TMPDIR
that each removes on exit, so what a killed child leaves behind still goes
with the run. `scripts/scratch.sh` says where those directories live:
`OH_SCRATCH_ROOT`, else an expiring `/var/tmp/agent-scratch` when the host
offers one, else `/var/tmp`. Ad-hoc scratch belongs in the same place. A
directory made directly in `/var/tmp` is never aged, so a run that cannot
remove it leaves it until someone does. Keep scratch paths short, because
tests put Unix sockets under TMPDIR and socket paths are limited to 108 bytes.
Go tests bind sockets under `t.TempDir()` with long test names, so their
TMPDIR may be at most 21 bytes, which is shorter than `/var/tmp/agent-scratch`
itself. `ci-local.sh` and `test-focused.sh` therefore put their Go run's
directory directly in `/var/tmp` under a short name and remove it on exit, and a
direct `go test` runs with TMPDIR unset or `/var/tmp`, not under the scratch root.

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
runs with `--config web/playwright.lab.config.ts`, whose results are in
`web/test-results-lab`). The gate runs untraced. From the repository root:

```sh
./scripts/inspect-trace.sh web/test-results/<test>/trace.zip
./scripts/inspect-trace.sh --json web/test-results
```

The directory form requires exactly one `trace.zip`; pass a specific archive
when several tests produced traces. The script extracts into a fresh private
`oh-trace.*` directory under `$TMPDIR` (Linux default: the scratch root above;
disk-backed storage required), prints its path, a bounded summary of failed actions,
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
| Preparation, storage gate and first-login account creation without user quotas, `/home` on the root filesystem | `./scripts/vm-test.sh host-shared-home --json` |
| Native gh catalog with separate kernel UIDs; the read-only Gitea connector under two UIDs with distinct PATs: tea state, connection IDs, clone/cancel/stream jobs, fetch, helper, shell Git, PAT replacement/revocation and disconnect stay each person's, clones survive disconnect, and only the gateway peer is served | `./scripts/test-repo-catalog-uids.sh` (networkless disposable container; synthetic Gitea with its CA in the container's system trust, real Git; not a real Gitea or installed host) |
| A site default a person cannot read never reaches their daemon, `gh`, home or browser replies, while the readable ones are handed off with the token over the real transport and cloned (gateway, two daemons, three kernel UIDs) | `./scripts/test-onboarding-defaults-uids.sh` (networkless disposable container; broker and GitHub are fixtures) |
| Fixed-path shared Pi selector with distinct UIDs | `./scripts/test-shared-pi-selector.sh` |
| Agent socket own-UID/root/gateway denials, gateway-only route absence and two-socket broker readiness | `./scripts/test-agent-uids.sh` |
| Pi attempt and integration account peer/UID/socket denials | `./scripts/test-pi-attempt-uids.sh` |
| Editor file reads/writes, foreign IDs/ownership, gateway-only peers under distinct UIDs, and bind-mount refusal | `./scripts/test-editor-files-uids.sh` (networkless disposable container; not installed-host boot/systemd evidence) |
| Browser shell runs as its person in the workspace, cannot reach another person's home, daemon or tmux server, and outlives its connection | `./scripts/test-terminal-uids.sh` |
| A person's Tailscale node (the pinned `tailscaled` with the daemon's own command line and locked config) is unreachable for another kernel UID through its LocalAPI (status, `nc` dial, prefs) and keeps shields up against its owner's `tailscale set` | `./scripts/test-tailscale-uids.sh` (networkless disposable container; no systemd, real tailnet or peer: the unit's 0700 RuntimeDirectory is made by hand there, and a live peer's inbound probe is not exercised) |
| A broker-written app credential (production integrations file and host lock) makes the provider available to another person's daemon catalog run as that person, who can read but not write the file | `./scripts/test-integration-apps-uids.sh` (networkless disposable container; no gateway, systemd or provider) |
| Broker boot start of syncing people's daemons by their own signal only, linger targets under distinct UIDs, and a withdrawal's or root revocation's native stop of exactly the revoked person's daemon and two sockets as root (loginctl and systemctl mocked) | `./scripts/test-broker-boot-uids.sh` |
| Real pinned Pi controller under mapped UIDs | `OH_PI_ARTIFACT_DIR=<archive-directory> ./scripts/test-real-pi-controller.sh` (cached image/archives required; Go from `.tools/` or PATH) |
| Real Pi executes the supplied notice recipe in one tool call through the production CLI and own-UID agent listener | `./scripts/test-native-pi-notice.sh` (installed Pi SDK fixture and cached VM-tools container image required) |

The native notice fixture runs in a networkless rootless container. Container
PID 1 creates the CLI's fixed-path socket and passes it to a synthetic controller
under a nonroot UID; production CLI socket-trust and daemon peer checks still
apply. A loopback synthetic model executes the notice recipe delivered in Pi's
actual system prompt. This proves PATH, prompt delivery, native tool execution
and first-write persistence, not arbitrary model obedience, provider entitlement
or installed systemd lifecycle.

Guest scenarios need rootless Podman and a cached or downloadable image.
A change to a scenario states its claim and limits in the result of the
issue that makes it. These synthetic runs do not establish real
provider behavior or live-server isolation. An installation's own deployment
preflight and receipts record the live-host evidence.

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
A Playwright spec that writes such evidence does so only when
`OH_VISUAL_CAPTURE=1` (or its own named capture switch) is set, so the ordinary
suite and the clean gate never rewrite tracked files under `issues/`.

The installation foundation's `./scripts/test-host-initialization-uids.sh` runs
broker seed/admission and operation journal filesystem tests as actual root in
a disposable networkless Ubuntu container, including foreign-kernel-UID denials.
It also exercises apply's no-write qualification/approval refusals and split
receipt/fence publication at every journal phase. It simulates broker high-water
observation by writing a synthetic head fixture and process interruptions by
writing the successor receipt without the active fence; it does not start
systemd/broker/gateway services, enforce quotas, activate an installation or
prove crash persistence across a power loss.

The same container also runs host storage-observation tests with synthetic
mountinfo, block-device identities, superblocks and kernel enforcement results.
`go test -v ./internal/host -run TestStorageExt4Image` additionally validates the
quota feature/UUID parser against disposable **unmounted** ext4 images built by
local e2fsprogs (skips when `mkfs.ext4` is absent). Neither test mounts a volume,
enables quotas, writes as a quota-limited UID, starts boot gates or establishes
cold-reboot/systemd acceptance. A passing storage check is a point-in-time kernel
read, not the explicitly approved EDQUOT probe that preparation must later run.

That same container runs the release authentication/private-staging tests: root
stages synthetic pinned USTAR/GNU archives, while a distinct kernel UID is denied
both the staging API and reads of its private output. These tests cover the manifest pin,
exact-target/profile, archive-policy and cleanup boundaries. They do not qualify
a real Node/Pi/deb closure or exercise the production daemon startup validator as
mapped users; that runtime acceptance remains separate from archive authenticity.

The host container also exercises preparation's no-write qualification and
actual-foreign-UID refusal. Its root CLI cases check prepare/apply fingerprint
separation, explicit disruption approval and blocked/stale JSON/JSONL results;
the supported storage baseline is absent in those CLI refusal cases. The same
container now exercises the preparation executor through synthetic storage/probe
callbacks; those are not native EDQUOT or installed-boot-policy evidence.

`TestReleaseNativePackageQuery` (included by the same root-container runner)
queries its actual dpkg database with a clean fixed native command despite
poisoned ambient PATH/DPKG variables. Synthetic manifest expectations demonstrate
exact-match and drift classification; no package is installed or downgraded.
Other package-observer regressions inject missing/broken/partial/error records
and test the output bound through `io.Copy`. This does not establish complete
release closure, executable-byte integrity, a mapped-user Pi startup or package
installation. Query cancellation is injected, not a native timeout/signal test.
The runner explicitly sets test executable modes so distinct-UID subprocesses
reach their test entry points even when the build shell uses umask 077.

`TestReleaseNativePackageDatabaseAvailability` uses disposable synthetic dpkg
admin directories, not the host database. A missing/empty base status file with
matching surviving updates must remain unavailable, while a valid base plus
updates can be observed. FIFO/directory/symlink bases are refused without blocking;
identical-content atomic replacement changes the observed base identity. These
checks detect normal base changes; they are not a lock against arbitrary
concurrent apt activity or a simulated power-loss recovery acceptance.

The opt-in `./scripts/vm-test.sh host-prepare-probe --json` builds the host
**test binary**, boots a fresh isolated guest with a separate disposable ext4
`/home`, and invokes the new quota-probe executor under the real operation lock.
The harness formats its own blank disk with internal journaled user quotas as
customer-owned storage provisioning; product code never formats it. It proves
an actual bounded unprivileged EDQUOT write, removal of the charged inode,
zero-usage/original-limit readback, durable cleanup evidence and a retained
incomplete-operation fence. Native `TestPrepareProbeCrashFences` simulates
writer loss at journal checkpoints; it is not SIGKILL/power-loss evidence.
This is **probe-library evidence only**, not `host prepare`, installed boot
policy, reboot or listener-gate acceptance. The production CLI journey is tested
separately below.

The preparation executor's `./scripts/vm-test.sh host-prepare --json` builds the
production CLI and exercises approved maintenance on its own blank ext4 `/home`
volume. The fixture, not product code, formats that disk as the customer-owned
provisioning step. Its `host-prepare-no-boot` proof requires real EDQUOT/cleanup,
completed operation inspection, exemption-group creation from an initially absent
group, installed policy files, a fresh-plan no-op, stale
approval refusal, accounting-only/unenforced quota refusal and missing-mount
refusal. It executes the approved proc/logind/polkit restart plan and checks effective
proc flags and running exemption groups, but does not reboot or prove cold
listener gates, real PAM sessions or user-manager behavior. The earlier
`host-prepare-probe` scenario remains a narrower library-only native check.
`python3 test/vm/test-host-prepare-fixture.py` compiles the actual rendered guest
script offline; syntax success is not a VM result. The native/root-container
`TestPrepare*` cases cover no-write previews, under-lock approval change, busy
writer, unsafe policy paths, no-op file/receipt stability and retained incomplete
operation fences. Callback probe/crash/cancellation cases remain simulations,
not substitutes for the native VM or power-loss/signal acceptance.

The core-runtime build uses checked-in `runtime/core/` npm and Ubuntu locks.
`./scripts/build-core-runtime.sh <new-absolute-output-directory>` downloads only
locked bytes in a disposable Ubuntu 24.04 container, ignores npm install scripts,
and retains notices plus complete component/file records. It builds the
multi-architecture builder image (`runtime/builder/Containerfile`) on first use,
not a host package installation. Builds take `--target linux-amd64|linux-arm64`
(default: the host's); core and integrations need a host of that architecture. `TestRelease{PlatformPackages,ExecutableArchitecture,NPMLockCPU}` and
`TestHostReleasePlatform` cover target selection in the verifier and operator;
`scripts/test-profile-runtime-build.py` covers the builders' target selection
and that both targets of every lock pin the same upstream versions. `go build ./cmd/runtime-release`
builds the separate release manifest writer and verifier; `docs/operations.md` describes
the digest pin it verifies against.

The core runtime's Taskfleet and workmux are locked in `tools` of
`runtime/core/artifact-lock.json`, which `scripts/rust-tool-lock.py` writes
from the upstream release when a pin moves. The core build checks every pinned
byte, that the crate list is exactly the released Cargo.lock, each crate's own
SPDX declaration and the licence allowlist in `scripts/rust-tools-runtime.py`,
runs both binaries to compare their versions with the lock, and writes the Pi
skills from the pinned Taskfleet itself. `TestReleaseClosureCoreAgentTools`
covers the closure rule for `runtime/agent-bin`, `TestReleaseCoreAgentToolsObserved`
the host check row, and `OH_CORE_ARTIFACT_DIR=<build output> go test ./internal/host
-run TestReleaseClosureBuiltCore` verifies a real build's archive as the release
verifier does. A disposable native run is `taskfleet run create --kind spinoff
--headless` from a throwaway HOME and repository with the build's
`payload/runtime/agent-bin` last on `PATH`, then `run cancel`: it proves the
binaries, the launcher's Pi and its skills (Pi's RPC `get_commands`, where a
personal or project skill of the same name must win) under one
UID, not a mapped account, a model turn or the Workers panel.

`go test ./internal/host -run 'TestReleaseClosure'` covers file/component/licence
membership, digests/modes and npm/deb lock disagreement. Existing Release tests
cover the digest pin, target approval, hostile archives and private staging cleanup;
`test-host-initialization-uids.sh` runs them as root with foreign-UID denials.

`./scripts/vm-test.sh host-shared-home --json` is the installation without user
quotas on an ordinary single-filesystem server: the guest has no second disk,
so `/home` is a directory on the ext4 root filesystem without quota features.
It runs the production `host check` and `host prepare` (no probe, policy with
`user_quota: false`, a `no_change` rerun), refuses a quota site on the same
host, seeds only empty broker state, and lets the production broker create two
accounts at first login with no default limit, as the gateway UID. Quota reads
must say `not_in_use` and a limit change `quota_not_in_use`; after one cold boot
the real storage gate, broker restoration, named ACLs and cross-UID denials are
checked again, and a policy naming another filesystem is refused. It is not
`host apply`, runtime, gateway or browser acceptance. Offline,
`python3 test/vm/test-host-shared-home-fixture.py` compiles the rendered guest
program and checks the receipt validator's negative oracles. Quota mode keeps
its own scenarios below and above.

`./scripts/vm-test.sh host-boot-storage --json` extends production preparation
with four distinct guest boots: qualified home, quotas unenforced, absent home,
and declared UUID mismatch. It exercises the installed systemd dependency graph
and both real socket templates; a synthetic broker body marker isolates ordering
from the broker's independent config/ledger checks. Per-user directories are
synthetic, **not broker-restored named ACLs or committed-binding acceptance**.
No real broker startup, linger, user-manager or logind/polkit session acceptance
is inferred. The guest itself provisions its blank home disk; product code does
not format or edit fstab. Offline
`python3 test/vm/test-host-boot-storage-fixture.py` compiles both rendered programs
and checks missing/false receipt fields, including with optimized Python; that
is not a VM result. The root-container runner also exercises boot policy file
trust (writable ancestry, symlinks, hardlinks and foreign ownership).


`TestPrepareNativeProcGroup` runs only with `HOST_PREPARE_GROUP_CONTAINER=1` as
root in a disposable networkless VM-tools Ubuntu container. It invokes actual
fixed-path getent/systemd-sysusers to create the one empty exemption group and
checks repeat stability and real NSS primary-membership/GID-alias refusal; the
ordinary native test run skips it, never creates a
group on the development host. `TestPrepareProcGroupParser` checks unsafe member,
GID, alias, primary-member and multi-record refusals. The production prepare VM asserts that the group
is initially absent and is created by the operator, not by a fixture prerequisite.
This prevents missing-group logind/polkit startup failure, but is not session
behavior or restart acceptance.


`./scripts/vm-test.sh host-boot-binding --json` uses production preparation,
empty broker installation state and real gateway-kernel-UID ensure exchanges.
Only the broker creates the two accounts, bindings, quotas and per-user ACLs.
Five fresh boots exercise admitted restoration, pending state, revocation,
admitted-but-foreign native identity, and recovered admitted restoration.
Both cold listeners must refuse each negative target without acquiring a
per-user directory. Positive boots check exact named ACLs, cross-UID traversal
denial, socket ownership/modes, native linger flags, active user managers and
user buses. Real PAM session creation and polkit process-subject authorization,
plus user-manager-owned processes under host hidepid, cover session behavior.
This is not Pi/provider/application request acceptance or a host apply executor.
The separate storage fixture deliberately substitutes the binding gate as well
as the broker body; only this binding fixture uses the unmodified production
gate and broker. Neither fixture is evidence until it actually passes.
`python3 test/vm/test-host-boot-binding-fixture.py` compiles rendered programs
and rejects missing/false receipt fields with normal and optimized Python;
it never boots a VM.

`TestColdRuntimeACLNative` runs only with `HOST_COLD_ACL_CONTAINER=1` as root
in the disposable VM-tools container. It exercises actual fixed-path ACL tools
on an initially absent runtime tree, both identities, extra foreign named ACL
refusal and refusal to repair existing drift. Ordinary developer tests skip it.
It is filesystem/ACL evidence, not systemd boot or committed-admission evidence.


Optional runtime builds use `scripts/build-profile-runtime.sh PROFILE NEW_OUTPUT`.
`scripts/test-profile-runtime-build.py` checks deterministic sealing, executable
modes, editor alias semantics without ambient Node, malformed Ubuntu requirement
and refusals. The independent Go
verifier rejects Ubuntu deb payloads and optional npm components without a native
lock. `TestDebVersionOrderingMatchesDpkg` checks minimum version ordering against
dpkg; Ubuntu planning tests check union, newer versions, candidate and solver
refusals, and non-mutating simulation. `bash scripts/test-ubuntu-requirements.sh`
runs the actual native host apt adapter as root only inside a disposable rootless
Ubuntu 24.04 container, installing all declared requirements and checking their
minimums. It is not systemd, per-user workflow or installation acceptance evidence.
`runtime-release manifest --artifacts-file FILE` accepts a descriptor array;
verify/stage cover every manifest artifact, not just implicit core.

`python3 scripts/test-python-runtime-build.py` checks the pinned Python 3.14
profile for source/notice completeness, input tampering and escaping aliases;
`python3 scripts/test-browser-runtime-build.py` checks the browser archive's
paths, digests, notices and versions. These are builder checks. No repository
test runs the profiles' native workflows (editor, containers, browser, uv/python)
under mapped users; a real installation is the only evidence for them.

### Release qualification on a cloud VM

Release qualification installs the release exactly as a customer would, on a
fresh Ubuntu 24.04 cloud VM of the release's architecture rather than an emulated guest: the stock image
brought to current updates from its stock mirror, a separate blank volume
formatted as the ext4 `/home` with enforced user quotas, and the gateway on port
443 with TLS. Emulated guests never met the deployment defects the first
customer installation found (site validation, OS package drift, the proc group
ID, the provider's apt mirror, configuration-parent mode, port 443), and they
loaded the shared development servers.

Run it before a release goes to a new installation. An upgrade of existing
installations is qualified on a staging installation instead: it is upgraded
first, and the others follow once its upgrade has passed its host checks and
live use.

```sh
python3 scripts/cloud-qualify.py run --operator OPERATOR --expect-apt-mirror MIRROR \
  --predecessor RELEASE_DIR --successor NEXT_RELEASE_DIR --json
```

Each release directory holds what a customer downloads for one release: exactly
one `open-habitat-*-linux-<amd64|arm64>.tar.gz` package, `release.json` and
every archive the manifest names; the harness pins each manifest's own SHA-256
in the site and delivers nothing else, so the predecessor must be a
release whose operator authenticates by that pin alone. The successor's
manifest must name that exact predecessor; without `--successor` the
receipt reports the upgrade as not covered. `plan` checks the same inputs
offline and prints the stages.

The predecessor is normally the published release a customer runs, downloaded
with `gh release download`. A successor from the current tree is built the way
a product-only test release is: package it, then write a manifest that reuses
the predecessor's archives and names it as the predecessor.

```sh
./scripts/prepare-release.sh --gate ungated --version NEXT --output PKG_DIR \
  --target linux-amd64 --remote origin --branch main
mkdir NEXT_RELEASE_DIR DESCRIPTORS
for a in $(jq -r '.artifacts[].archive' RELEASE_DIR/release.json); do ln RELEASE_DIR/"$a" NEXT_RELEASE_DIR/; done
cp PKG_DIR/open-habitat-NEXT-linux-amd64.tar.gz NEXT_RELEASE_DIR/
python3 scripts/successor-descriptors.py --predecessor RELEASE_DIR \
  --package NEXT_RELEASE_DIR/open-habitat-NEXT-linux-amd64.tar.gz --output DESCRIPTORS
runtime-release manifest --directory NEXT_RELEASE_DIR --version NEXT --commit "$(git rev-parse HEAD)" \
  --platform "$(jq -r .platform RELEASE_DIR/release.json)" \
  --artifacts-file DESCRIPTORS/artifacts.json --upgrade-file DESCRIPTORS/upgrade.json
```

`runtime-release` is built as in `docs/operations.md`. Most of a run's time
is the first upload of the release from the qualification host; the
successor's unchanged archives are not sent again. `--server-type` and
`--location` choose among what the operator allows when its defaults have no
capacity.

The harness holds no cloud credentials. `run` requires an explicit
`--operator`, an executable implementing the qualification VM create/destroy
contract, and the `--expect-apt-mirror` the stock image must use; it never
discovers a fleet operator from the machine. The operator creates a labelled
short-lived server and blank volume, opens SSH and 443 only to the
qualification host, pins the server's SSH host key and destroys everything
when the run ends; its expiry label (`--ttl-minutes`) lets a reaper remove the
VM of a run that died. `target --target FILE` runs the same qualification on
any freshly booted stock VM provisioned some other way (host, port, user, key,
pinned `known_hosts` line, blank volume device).

When no operator offers arm64 server types, an arm64 release is qualified with
`target` against a stock arm64 cloud image booted under QEMU (TCG, no KVM) in
a disposable rootless container; the harness runs in the same container and
reaches the guest's SSH and 443 through its loopback forwards. Keep the release
directories on that machine, since the upload dominates otherwise. A run takes
hours under emulation. `prepare-release.sh --target linux-arm64` cross-builds
the product; `verify-release.sh` then warns
`embedded_identity_unverified` because it cannot execute the binary, and the
preparer instead checks that the approved commit and version are embedded.

The VM is installed only through the delivered `bin/open-habitat host` operator
and the upgrade owner it stages; nothing from this checkout or from the
qualification host's own tooling is placed on it. The harness itself performs only what a customer owns: OS updates
(and the reboot they require), the volume's filesystem and fstab entry, the
protected site and secret files, TLS from a per-run CA whose key never
leaves the qualification host, and, before the upgrade, a placeholder Dropbox
app section in `integrations.json`, as a customer entering app credentials
would. Observation probes run as root over SSH.

The run covers prepare; apply with a refused wrong approval, a SIGKILL at
`converging` continued under the original approval and an exact `no_change`
repeat; first use through the broker socket as the gateway UID for two
synthetic people, each own-UID agent environment answering 200 while the other
UID is refused, the bound administrator granted on re-apply and a quota
override, and each person's integration catalog read through the daemon socket
as the gateway (IMAP, CalDAV, CardDAV and Apple available, Google, Microsoft and
Dropbox waiting for app credentials, every shipped tool root-owned in
`integrations.json`); a cold boot with host check, CA-validated public HTTPS,
agents, quotas, home state, the unchanged integrations file and catalog and a
`no_change` apply; then the upgrade staged by the
successor package and run by its owner, killed at `activating`, booted while
fenced (public HTTPS must not serve), continued to `upgraded` with the running
gateway executable equal to the successor binary, a transient user service of
one person (the browser shell's and Taskfleet's shape) started before the
quiescence and another before the continuation both still running with the
same PID and the operator's app
section kept byte for byte (Dropbox now available), and a final cold boot with
the same checks. Progress is JSONL on stderr; the result document on stdout
(and `--receipt FILE`, never overwritten) records input digests, each stage's
observations and the first failure. Exit 0 is a pass, 1 a failed qualification
or infrastructure failure, 2 invalid input. A pass whose VM could not be
destroyed is a failure.

It does not cover browser OAuth, model-provider authorization, public-CA
issuance, DNS or ingress, per-profile native workflows, or torn writes on power
loss; the receipt lists these. The fresh-installer experiment, in which an
independent agent installs from the published materials alone, remains the
final acceptance before a customer release. The `vm-test.sh` scenarios remain
for conditions a customer-path VM should not be driven into: boots with an
absent, unenforced or mismatched home volume, pending, revoked or foreign
bindings, and broker crash points.

`python3 scripts/test-cloud-qualify.py` checks the harness offline against a
scripted fake SSH target and a fake operator: approvals threaded from the dry
runs, only product binaries and stock OS tools executed on the target, no
formatting of a non-blank volume, fenced entry after an interrupted upgrade,
teardown after failure and interrupt, and SSH host-key pinning. It proves the
harness's logic, not the behaviour of any VM.

### Integration tools and Microsoft native single-grant qualification

Build `./scripts/build-profile-runtime.sh integrations "$SCRATCH/NEW_PROFILE"` (`SCRATCH` is a
task directory under the scratch root above, removed afterwards), then
run `python3 scripts/test-integrations-runtime.py "$SCRATCH/NEW_PROFILE" CORE_RUNTIME` (a built or installed core's `runtime/`, read-only) to inspect
the sealed native tools, npm/Node closure, notices, file digests/modes and
minimal-env wrappers. It runs himalaya, rclone, gog and tea for their pinned
versions and the real Pi wrapper through a profile link, including native MCP
add/remove/logout. It is a package check, not release-pin, installed-UID or
live-provider acceptance.

For real-Pi integration checks, lay out the built integrations `runtime/` at
`GEN/payloads/integrations/runtime` beside `GEN/payloads/core/runtime` (the latter
may be a read-only symlink to the core input). Run
`OH_INTEGRATIONS_PI=GEN/payloads/integrations/runtime/bin/pi go test ./internal/daemon/integrations -run TestPiOAuthBuiltRuntime`
and `OH_CORE_RUNTIME=CORE_RUNTIME go test ./internal/daemon -run TestMCPBuiltRuntimeAgent`.
Use absolute paths. These opt-in tests use disposable homes and loopback fixtures:
the first drives the production RPC login child through `/mcp` to an authorization
URL without following it; the second uses production agent arguments and a local
model peer to call an MCP tool through native codemode and receive its result.
Neither proves real provider consent or Atlassian service permissions.

The Go tools' (`gog`, `rclone`, `tea`) `<tool>-THIRD-PARTY-NOTICES` are
generated by `scripts/go-binary-notices.py generate` from the module list both
targets' release binaries embed (network and Go needed). The builder refuses a
Go executable without such a notice, or whose modules differ from it, so a
version bump regenerates it; a module version without a usable licence file
needs a digest-pinned entry in the script's `SUPPLEMENTS`.
`python3 scripts/test-profile-runtime-build.py` covers the binding offline.
`./scripts/test-tea-interop.sh <profile>/payload/runtime/bin/tea` runs the
shipped tea against the native Gitea adapter on one synthetic home (default,
XDG and legacy `~/.tea` locations, the shared lock, each side's writes and
deletes). For arm64, cross-build the Habitat side with
`GOARCH=arm64 go test -c ./internal/nativegitea` and pass it as the second
argument on the arm64 host. `TestGiteaHelperSurvivesReleaseSwitchAndOldReleaseRemoval`
(`./internal/daemon`) switches a synthetic `current` selector and deletes the
old generation under an existing clone; it is not an installed upgrade. `go test ./internal/host -run
'TestMergeIntegrationTools|TestIntegrationsClosure'` covers the operator file
merge and the release pins; `TestApplyProfilePublicationAndUpgrade` publishes
the file as root in the disposable host container.

For synthetic grant/native reload/refresh evidence, copy the test-only
`runtime/profiles/integrations/{synthetic-entra,microsoft-import-fixture,microsoft-native.test}.mjs`
files beside the adapter in that disposable profile's `payload/runtime/` (never
into an installed runtime). Run its `bin/node microsoft-native.test.mjs` there.
The test sets a synthetic HOME/log directory before importing the native modules.
It exercises the pinned MCP AuthManager's encrypted-cache reload/silent refresh
for an organisation account through its tenant, including account mismatch,
provider refusal, transport cancellation preserving existing bytes, and refusal
of the `common`, `organizations` and `consumers` audiences. It also runs the
adapter's `verify` over the same store: a working grant, asked of the tenant
even with a cached access token, reads `ok` and persists its rotation, tenant refusals by error code read `refused` or `outside_tenant`,
and an outage, a 503 or a failing Graph read `unreachable`. No fixture endpoint
override exists in the production helper.

Set `OH_TEST_MICROSOFT_RUNTIME` to that disposable `payload/runtime` directory and
`OH_TEST_RCLONE` to the pinned **1.71.2** executable, then run
`go test -v -count=1 ./internal/daemon/integrations -run TestMicrosoftSingleGrantNativeRuntime`.
This connects the catalog's one union-scope request to real MSAL/MCP native stores
and rclone config reload/refresh/rotation against loopback-only OAuth/Graph
fixtures, and checks that the real adapter accepts the daemon's `verify` request. The ordinary integration tests cover pending/backoff, expiry, native
import cancellation, expected-account refusal and replacement rollback.
Neither test proves Microsoft consent/policy behavior; a real person's next
browser connect is the live acceptance.
With the same `OH_TEST_MICROSOFT_RUNTIME`,
`go test -count=1 ./internal/daemon/integrations -run TestMicrosoftMCPToolsPinnedServer`
starts the pinned server with each level's registration arguments and checks
that it offers the file search and read tools and none that write, requests
only permissions the level's application holds (the build's scope patch), and
keeps the Outlook tool set of the earlier presets. It needs no network and
proves nothing about Microsoft's answers.


`./scripts/test-gateway-bind.sh` exercises a nonroot gateway-like process with
`NoNewPrivileges` in a disposable networkless Ubuntu container whose **private**
network namespace requires privilege below port 1024. Port 443 fails without
capabilities and succeeds with exactly `CAP_NET_BIND_SERVICE`; port 8443 succeeds
with an empty set. Host tests separately cover declared-port unit rendering,
foreign-policy refusal, and same-approval seq-12 journal continuation with the
bounded unit repair. This does not start systemd, use customer inputs, or prove
installed-host/public TLS/reboot acceptance. The script never changes the host
sysctl or file capabilities.
