# Repository scripts

`scripts/ci-local.sh --clean --json` is the clean-checkout CI approximation and
is the source of truth for required checks. It uses disposable HOME, Go and npm
caches, performs a locked online fetch followed by an offline npm reinstall,
runs browser checks with a repository-local Playwright cache, proves generated
contract drift and release reproducibility, and rejects tracked-tree changes.

`package-release.sh` creates only `linux-amd64` foundation archives and
`verify-release.sh` checks archive checksum, file manifest, required contents and
version provenance. These scripts do not install or activate a release.

`vm-test.sh self-test --json` validates the immutable Ubuntu image recipe and
synthetic two-UID cloud-init input. It deliberately does not claim that QEMU or
systemd isolation ran; full VM scenarios belong to their later implementation
owners.

Documentation validation remains `python3 scripts/validate-project-view.py`.
