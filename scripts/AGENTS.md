# Repository scripts

`scripts/ci-local.sh --clean --json` is the clean-checkout CI approximation and
is the source of truth for required checks. It uses disposable HOME, Go and npm
caches, performs a locked online fetch followed by an offline npm reinstall,
runs browser checks with a repository-local Playwright cache, proves generated
contract drift and release reproducibility, and rejects tracked-tree changes.

`package-release.sh` creates only `linux-amd64` foundation archives and
`verify-release.sh` checks archive checksum, file manifest, required contents and
version provenance. These scripts do not install or activate a release.

`vm-test.sh self-test --json` remains a fast offline recipe check, not boot evidence.
`vm-test.sh systemd-self-test --json` explicitly builds/uses the digest-based
rootless Podman tool image in `test/vm/Containerfile`, downloads the checksum-pinned
Ubuntu cloud image to `.cache/vm/`, and boots a private QEMU TCG overlay. It
proves only synthetic systemd/two-user socket/permission fixtures, not the product
route. `vm-test.sh two-user-routing --json` additionally builds the current
CGO-free binary, injects it on a private read-only ISO, and exercises the real
HTTPS OAuth callback and per-user systemd daemon routes inside the guest with
synthetic identities and fake native `gh`/`git`. It is an explicit VM product
proof, not a clean-CI or browser-visual test. Run `bash test/vm/test-vm-test.sh`
for offline parser, seed/ISO and failure checks; see
`issues/build-workspace-slice/phase-2-native.md` for exact product evidence and
`phase-2-vm-prereq.md` for environment-only scope.

Documentation validation remains `python3 scripts/validate-project-view.py`.
