# Test fixtures

Everything under `test/` is synthetic and disposable. The repository's rule that
tests never touch a real home, Pi history, SSH agent, browser profile or
credential is enforced here by construction: identities are `agent-a`,
`agent-b` and similar invented names, marker files carry invented strings, and
fixture trees are created at test time under a temporary path. Nothing in this
directory is a copy of anyone's data, and `test/fixtures/native/README.fixture`
records that provenance for the checked-in samples. If a fixture ever needs
something that looks like a real credential or history, that is a signal the
design is wrong, not a reason to redact a real one.

Three things live here.

`test/vm/` is the material for `scripts/vm-test.sh`: the cloud-init seed, the
checksum-pinned Ubuntu image recipe in `image.env`, the digest-pinned
Containerfile for the rootless Podman tool image, and the Python fixture and
proof scripts that are copied into a QEMU guest. The host-side script and the
proofs each scenario makes are described in `scripts/AGENTS.md` and the
per-scenario records under `issues/prove-jit-guest-isolation/`. The socket
responders in the cloud-init seed are stand-ins for the systemd-only scenario;
the later scenarios inject the real binary. `test-vm-test.sh` and the
`test-*.py` files here are offline checks of the host script and the fixture
contracts; they boot nothing and run in seconds.

`test/browser-host/` is a standalone Go TLS host that Playwright starts against
a production `web/dist` build. It mounts the real gateway and daemon handlers
with synthetic seams and is never imported by the product binary.
`web/AGENTS.md` explains its role and its `/fixture/` control prefix.

`scripts/native-fixture.sh create --output <new path>` builds the native
workspace fixture: a 2,500-event Pi-shaped JSONL history including a malformed
file, a long output, an edit and a question, plus a non-Git directory, a Git
repository and a linked worktree. The linked worktree is a plain `git worktree`,
and the manifest says so, because the fixture deliberately does not imitate a
Taskfleet-owned lifecycle. A test built on it cannot claim to have covered
Taskfleet integration.

A few things about the VM scenarios are easy to get wrong from the outside.
`self-test` is the only scenario the CI gate runs, and it boots nothing. Every
other scenario needs rootless Podman, downloads a roughly 600-megabyte image
into the git-ignored `.cache/vm/` on first run and keeps it there, and takes
minutes. Each run's private directory is removed by the script's exit trap; a
failed `jit-concurrent` run additionally leaves a private copy of the serial
log in `.cache/vm/` for diagnosis. The image URL is checked against a literal
in `vm-test.sh` as well as the checksum in `image.env`, so repinning the image
means changing both. The JIT scenarios read Fleetrepo's guest gate files with
`git show` from the commit pinned in `jit-fixture.py`, using the checkout at
`FLEETREPO_JIT_SOURCE`, defaulting to `/home/maintainer/Sources/fleetrepo`, only as the
object store, and verify them against hashes in the same file; a newer version
of those files in Fleetrepo is not exercised until the commit and hashes are
repinned here. The guest-only fixture tokens are constructed at runtime. The
scenarios that use them scan the serial log and the built binary for them, and
`two-user-routing` and `jit-login` also scan the host script and every
`test/vm/*.py`, so a token pasted as a literal into a proof script fails those
runs. Proof scripts report a single `VM_PROOF=` JSON line on serial, and the
serial log is what the host reads, so nothing secret goes to stdout or stderr
inside the guest.

When a machine has no rootless Podman, a guest scenario has simply not been
run. Report it as unverified, not as passed, and say which scenario would have
covered the change.
