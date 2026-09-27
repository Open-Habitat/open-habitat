# Repository scripts

`ci-local.sh --clean --json` is the clean-checkout CI approximation and the
source of truth for required checks. It uses a disposable HOME and caches, a
locked online fetch followed by an offline npm reinstall, repository-local
Playwright browsers, generated-contract drift and release reproducibility
checks, and fails on any tracked-tree change.

`package-release.sh` builds `linux-amd64` release archives, and
`verify-release.sh` checks the checksum, file manifest, required contents,
socket directory mode and version provenance. `test-package-socket.sh <archive>`
checks that world-searchable socket templates are rejected. None of these
install or activate anything.

The packaged socket `DirectoryMode=0710` is only a fallback, not isolation.
Before any socket activation, including after every reboot, the root operator
must create and verify the root-owned parent, the per-UID directory and the
named ACL that lets only that daemon UID and the gateway traverse it. Package
verification cannot check host ACLs; activation must fail closed without them.

`vm-test.sh` runs disposable QEMU guests:

- `self-test --json` is a fast offline recipe check and part of the clean gate.
  It boots nothing.
- `systemd-self-test --json` boots a checksum-pinned Ubuntu image with a
  digest-pinned rootless Podman tool image (`test/vm/Containerfile`) and proves
  synthetic systemd, two-user socket and permission fixtures only.
- `two-user-routing --json` also injects the current binary and exercises the
  real HTTPS OAuth callback and per-user daemon routes with synthetic
  identities and fake native `gh`/`git`.
- `broker-guest`, `jit-provision`, `jit-login` and `jit-reboot-diagnostic`
  exercise the root broker and first-login account creation in a private guest.
  What each has and has not proved is recorded in
  `issues/prove-jit-guest-isolation/`.

`bash test/vm/test-vm-test.sh` runs the offline parser, seed/ISO and failure
checks. Documentation validation is `python3 scripts/validate-project-view.py`.
