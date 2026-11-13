# Repository scripts

Everything in this directory checks or packages the repository without changing
the machine it runs on. Tools are fetched into disposable homes, caches and
`.tools/`, guests are thrown away, and nothing here installs, enables or
activates a service. That is deliberate: development machines are often
converged from a declared configuration, and a script that left a binary or a
package behind would create drift nobody declared. Keep new scripts on the
same side of that line.

Testing policy, gate invocation and evidence limits live in the root
`TESTING.md`; this file records the packaging and fixture constraints behind
these scripts.

`check-licenses.py` fails the gate on any direct web dependency without license
metadata or under a GPL-family license, because the repository will be public
and the license boundary is decided here rather than at release time. Adding
such a dependency is a decision to raise, not a check to relax.

## Test execution

Tests use ordinary commands (`npm`, `go`, `npx playwright test`) and run
natively by default. No script here places a suite on another machine.

Every checkout and worker shares one repository config, so no test may reach
it. `git bisect run`, hooks and `git rebase --exec` export `GIT_DIR`, and a
scratch `git init <dir>` that inherits it reinitialises the caller's
repository instead, from a linked worktree as bare. Entry scripts and Python
tests drop `git rev-parse --local-env-vars`; Go test packages that run git and
the browser host call `internal/testgitenv.Scrub` (TestMain, `main`); a new git
fixture outside them gives git an explicit environment. `ci-local.sh` fails if
the shared config's `core` section changed during the run.

## Release archives

`package-release.sh` builds the `linux-amd64` or cross-built `linux-arm64`
archive and `verify-release.sh`
checks it. The archive is what a root operator unpacks onto an installation,
so the systemd templates it carries are the effective unit files there. That is why the verifier is exact rather than
lenient: it accepts only the reviewed set of directives in the broker units and
exactly one `DirectoryMode=0710` in the daemon socket, rejects duplicates and
whitespace variants that systemd itself would accept, rejects source maps and
any trace of test fixtures in the web assets, and rejects files it has not been
told about. `test-package-socket.sh` is the negative side of the same check,
repackaging deliberately unsafe archives and proving they still fail. Changing a
broker unit, or the daemon socket's `DirectoryMode`, therefore means changing
the verifier's expectations, and usually a negative case, in the same commit.

`prepare-release.sh` requires an explicit source remote and branch,
architecture and gate mode; it selects no installation or release policy, so
a maintainer's own release operator supplies those. It refuses an unpushed or
dirty tree, and in clean-gate mode a gate receipt for any other tree, because
the published bytes must be the ones the gate and the remote both saw.

A verified archive says nothing about a host. The daemon socket template's
`DirectoryMode=0710` only removes world traversal; the real isolation is a
root-owned directory and named ACL that the host operator and the
installation's activation preflight prepare and check before any socket is
activated, and that no script here can see. Do not present package
verification, or a passing guest, as evidence of host isolation.

## Disposable guests

`vm-test.sh` boots disposable QEMU guests inside rootless Podman. `test/AGENTS.md`
describes the fixture material, the image cache, the private-source pinning and the
fixture-token scanning; this file records what each scenario is for.

- `self-test` checks the recipe offline and boots nothing. It is the only
  scenario the gate runs.
- `systemd-self-test` boots the pinned image with socket responders from the
  cloud-init seed. It proves the systemd, two-user socket and permission
  fixtures, not the product.
- `two-user-routing` injects a locally compiled binary into a guest with
  precreated accounts and exercises the real HTTPS OAuth callback and per-user
  daemon routes with synthetic identities and fake `gh` and `git`. It is the
  static baseline and does not cover first-login provisioning.
- `broker-guest`, `jit-provision`, `jit-login`, `jit-concurrent` and
  `jit-reboot-diagnostic` cover the root broker and first-login account
  creation. `jit-concurrent` alone needs a clean committed tree, because it
  packages and verifies a release and refuses to run unless the embedded commit
  is HEAD; the guest gets the archive's binary and templates, and its web
  assets are verified but never served. `jit-reboot-diagnostic` is a diagnostic
  that writes a bounded receipt under the ignored `history/`; it has not been a
  passing proof.

Every guest result is synthetic evidence from a private guest, never live host
evidence. When a scenario or proof changes, the result of the issue that
changes it states the claim and its limits, since a guest pass without an honest statement of what it
covers is the kind of evidence this project refuses to produce.

## Cloud VM release qualification

`cloud-qualify.py` changes only a disposable remote VM. It holds no cloud
credentials: provisioning, firewall, host-key pinning and guaranteed expiry
belong to the explicitly supplied operator and mirror, which the harness must
not discover from the machine. A crashed harness must never be the only thing
standing between a disposable cloud server and its bill. Its `run` command
treats a failed teardown as a failed qualification for the same reason.

What the harness may do on the target is bounded by what a customer would do
before installing: update the OS, format the blank volume it was handed (never
one that carries a signature), write the protected site and secret files and
copy the published release in. Everything else goes through the delivered
`open-habitat host` operator, because the point of the run is that customer
conditions are the test conditions; a helper that quietly fixed the host would
reintroduce exactly the gap the emulated guests had. The per-run CA key stays on
the qualification host. Remote probes observe; the one synthetic action they
take is a first-login request on the broker socket as the gateway UID, since
there is no browser. `successor-descriptors.py` only writes the
descriptors for a product-only successor of a published release; `runtime-release
manifest` turns them into the manifest.

## Rootless shared-selector proof

`test-shared-pi-selector.sh` compiles the core test into `.cache/` and runs it in a networkless rootless container. It uses the fixed `/opt/open-habitat/pi-runtime.json` path as two separate UIDs with separate HOME directories while `/etc/open-habitat` is root:gateway 0750. Each UID must accept the root-owned readable selector and reject wrong owner, writable file or parent, and symlink file or parent. Ordinary `go test` skips the fixed-path test; this is a disposable container proof, not live host evidence. The gate does not run it.

`test-repo-catalog-uids.sh` is an opt-in offline three-kernel-UID catalog test. It compiles the daemon tests into `.cache/` and runs a disposable networkless container with separate synthetic gh credential homes, two daemon UIDs and a gateway UID. It proves socket owner isolation and native gh execution under each UID, not the browser or live provider.

## Rootless real-Pi controller proof

`test-real-pi-controller.sh` is opt-in and offline. It checks exact cached
Node/Pi archive hashes, builds the product CLI and starts it as two mapped UID
daemons plus a separate gateway UID in a disposable networkless rootless Podman
container. `test/real-pi-controller.py` supplies a root-owned static broker
protocol fixture, loopback TLS synthetic OAuth, per-user synthetic Pi auth/model
and fake native gh/git; the real pinned Pi CLI sends prompts and writes JSONL.
The prerequisite image and archives are not part of the clean gate. This does
not prove systemd lifecycle, Chromium interaction, real OAuth/provider, or a
live host. The tested revision and limits belong in the result of the issue
that runs it.

## Carried patches

`core-runtime-build.py` patches pi-claude-bridge at build time (`BRIDGE_PATCH`)
so Claude Code may run its WebSearch and WebFetch on the provider path. Every
bridge version bump re-applies it, and the build fails unless it applies
exactly once, so a moved line stops the build instead of shipping without web
search. Once upstream releases its `provider.builtinTools` setting, the patch
gives way to that setting. The setting lives in the person's own
`claude-bridge.json`, which the product does not write today, so that change
also decides how the runtime supplies it.

## The rest

`bootstrap-tools.sh` fetches a checksum-pinned Go into `.tools/` and prints the
`PATH` export to use, for machines whose Go is missing or too old.
`check-generated.sh` fails when `internal/contracts/` and `web/src/contracts/`
have drifted from `contracts/v1/`. `validate-project-view.py` checks the
structure of `docs/`, that local Markdown links in living documents
resolve, and that `history/` stays ignored and untracked, because Taskfleet
copies each worker's possibly private brief there; `validate-contracts.py` is the offline contract check
(`contracts/AGENTS.md`). `prune-closed.py` and `from-history.sh` carry out
the root `AGENTS.md` rule that finished working material lives in history:
the first lists or removes closed issues nothing living names, the second
prints a removed file from this repository, or an explicitly named `--archive`
checkout. Fresh public history contains no private archive objects. Pruning reads
additional living references only through repeatable `--reference-file` inputs.
The public validator requires no hosted space, private repository or narrative
files; while a private validator is present in the checkout, the gate runs it
as well.
`screenshots-to-avif.py` turns PNG screenshots under
`issues/` or `design-system/` into the AVIF that `issuectl doctor` expects;
it removes a PNG only after its own AVIF decodes at the same size, so workers
never need an `rm` on a variable path for this. `native-fixture.sh` builds the synthetic native
workspace that `test/AGENTS.md` describes. `vm-serial-drain.py` is the guest's
only channel back to the host: it caps the serial stream, retains only markers
and a bounded prefix, and voids the proof if a fixture token appears anywhere,
so a proof script that prints a secret fails rather than leaks.
