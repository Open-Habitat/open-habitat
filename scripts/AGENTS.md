# Repository scripts

Everything in this directory checks or packages the repository without changing
the machine it runs on. Tools are fetched into disposable homes, caches and
`.tools/`, guests are thrown away, and nothing here installs, enables or
activates a service. That is deliberate: Jari's machines are converged by
Fleetrepo, so a script that left a binary or a package behind would create drift
nobody declared. Keep new scripts on the same side of that line.

Testing policy, gate invocation and evidence limits live in the root
`TESTING.md`; this file records the packaging and fixture constraints behind
these scripts.

`check-licenses.py` fails the gate on any direct web dependency without license
metadata or under a GPL-family license, because the repository will be public
and the license boundary is decided here rather than at release time. Adding
such a dependency is a decision to raise, not a check to relax.

## Browser placement

Alder has no local heavy-execution budget. Maintained browser, web and selected
Go/contracts checks and CI health must route before checking local dependencies;
errors never fall back to local npm/Go/Chromium. Foreground capture pauses the
caller's cooperating writers until acknowledgement. Fleetrepo owns capture,
SSH, FIFO, dependency/cache isolation and the whole-job cgroup. Keep this adapter
thin; repository task declarations select trusted unprivileged phases, not
placement or resource authority. Verified guest phases execute locally inside
the existing slot, with at most two browser/test workers and bounded Go compiler
parallelism; a guest environment variable alone is never admission evidence.
Unrelated native Linux hosts retain local execution.

ARM test health and native amd64 release acceptance are different claims. The
remote gate executes native ARM tests and exports platform-attributed health;
it must never write the native production gate receipt, execute x86 binaries,
or restore fetched artifacts over source inputs. Native amd64 packaging,
reproducibility, archive and socket execution checks remain on native CI.
Minimal captured Git supplies original HEAD/tree/index and dirty bytes, not
history or branch refs: do not invent those proofs. `TESTING.md` owns caller
forms, explicit untracked selection and the source-writer cooperation boundary.

## Release archives

`package-release.sh` builds the `linux-amd64` archive and `verify-release.sh`
checks it. The archive is what a root operator unpacks onto the test server
through Fleetrepo's `RELEASE-UPGRADE.md`, so the systemd templates it carries are
the effective unit files there. That is why the verifier is exact rather than
lenient: it accepts only the reviewed set of directives in the broker units and
exactly one `DirectoryMode=0710` in the daemon socket, rejects duplicates and
whitespace variants that systemd itself would accept, rejects source maps and
any trace of test fixtures in the web assets, and rejects files it has not been
told about. `test-package-socket.sh` is the negative side of the same check,
re-signing deliberately unsafe archives and proving they still fail. Changing a
broker unit, or the daemon socket's `DirectoryMode`, therefore means changing
the verifier's expectations, and usually a negative case, in the same commit.

A verified archive says nothing about a host. The daemon socket template's
`DirectoryMode=0710` only removes world traversal; the real isolation is a
root-owned directory and named ACL that Fleetrepo prepares and checks on the
host before any socket is activated, and that no script here can see. Do not
present package verification, or a passing guest, as evidence of host
isolation. Fleetrepo's `SOCKETS.md` and its activation preflight own that side.

## Disposable guests

`vm-test.sh` boots disposable QEMU guests inside rootless Podman. `test/AGENTS.md`
describes the fixture material, the image cache, the Fleetrepo pinning and the
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

## The rest

`bootstrap-tools.sh` fetches a checksum-pinned Go into `.tools/` and prints the
`PATH` export to use, for machines whose Go is missing or too old.
`check-generated.sh` fails when `internal/contracts/` and `web/src/contracts/`
have drifted from `contracts/v1/`. `validate-project-view.py` checks the
structure of `docs/` and that local Markdown links in living documents
resolve; `validate-contracts.py` is the offline contract check
(`contracts/AGENTS.md`). `prune-closed.py` and `from-history.sh` carry out
the root `AGENTS.md` rule that finished working material lives in history:
the first lists or removes closed issues nothing living names, the second
prints a removed file. `native-fixture.sh` builds the synthetic native
workspace that `test/AGENTS.md` describes. `vm-serial-drain.py` is the guest's
only channel back to the host: it caps the serial stream, retains only markers
and a bounded prefix, and voids the proof if a fixture token appears anywhere,
so a proof script that prints a secret fails rather than leaks.
