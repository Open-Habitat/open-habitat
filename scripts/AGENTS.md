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
route. Run `bash test/vm/test-vm-test.sh` for focused offline parser and failure
checks; see `issues/build-workspace-slice/phase-2-vm-prereq.md` for scope and
measured boot evidence.

Documentation validation remains `python3 scripts/validate-project-view.py`.
