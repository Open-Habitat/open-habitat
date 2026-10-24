# Result: Ubuntu 24.04 arm64 as a supported installation target

## What changed

- **Signed manifests name their platform**: `ubuntu-24.04-amd64` or
  `ubuntu-24.04-arm64` (`internal/host/platform.go`). Ubuntu requirements in a
  manifest must be that architecture or `all`. The host operator installs and
  upgrades only a release for its own platform (`release_platform_mismatch`).
  Archive verification and staging check that every executable ELF entry point
  (`runtime/bin/*`, and the editor's `runtime/lib/node`) is a 64-bit
  little-endian binary for the platform. npm optional-package membership
  follows the platform's CPU (`x64`/`arm64`). The daemon's Claude login finds
  the SDK binary for its own CPU.
- **`runtime-release sign --platform`** is required. Signing the arm64
  archives as amd64 is refused.
- **Ubuntu declarations are architecture-neutral** (`platform: ubuntu-24.04`,
  `architecture: native|all`). Builders resolve `native` to the target. All 67
  declared minimums exist unchanged on arm64 (checked with `apt-cache policy`
  in an arm64 container).
- **Non-Ubuntu locks pin one official upstream artifact per target, at the
  same upstream version.** Node 22.21.1, himalaya, rclone, gog, code-server,
  uv, python-build-standalone (runtime + full metadata), Playwright and
  greenlet wheels, and MarkupSafe/PyYAML wheels all have official aarch64
  builds. Chromium headless shell for arm64 is Playwright's own CDN build (Chrome
  for Testing has no Linux arm64), which carries no licence notice. Its notice
  comes from the same-version Chrome for Testing linux64 archive (a locked
  `notice` input). No profile had to be marked unavailable on arm64.
- **Builders** take `--target` (default: the host's) and run in a new
  multi-arch builder image (`runtime/builder/Containerfile`, built on demand by
  `scripts/runtime-builder-image.sh`). Core and integrations, which run npm on
  the locked Node, must build on a host of the target architecture. The others
  build anywhere.
- **Product package**: `package-release.sh --target linux-arm64` cross-builds,
  reproducibly. `verify-release.sh` checks that the binaries' ELF architecture
  matches the package name. It cannot execute a foreign binary, so it warns
  `embedded_identity_unverified` instead. `prepare-test-release.sh --target`
  then checks that the approved commit and version are embedded in the binary.
  The gate builds and verifies the arm64 package twice and runs the negative
  package checks on it, including a re-signed package renamed to the other
  architecture.
- **Successor descriptors and cloud-qualify** know the architecture: an upgrade
  keeps the predecessor's platform, the successor binary's ELF machine must
  match it, and the harness requires a VM of the release's architecture.

## Evidence (where it ran)

All on **birch** (Ubuntu 24.04.5 arm64, Lima/VZ, no KVM), in
`/var/tmp/oh-arm64-nwkmy`, from commits `aba5aacd`/`bcc4d42c`. Open Habitat was
not installed on birch itself.

- Every profile built natively for linux-arm64: core, integrations, editor,
  uv, python, browser, containers, documents, media, native-build, operations,
  php. `runtime-release sign --platform ubuntu-24.04-arm64` signed all twelve,
  and `runtime-release verify` with the separate public key re-verified them.
  The same archives signed as amd64 were refused (`invalid_release`).
- `scripts/test-integrations-runtime.py` on the arm64 integrations profile
  passed: it ran himalaya, rclone, gog and the Pi wrapper natively.
- `TestUbuntuNativeAptContainer` in a disposable arm64 `ubuntu:24.04` container
  installed every declared requirement through the real host apt adapter:
  `ALL_UBUNTU_REQUIREMENTS_PASS 9 profiles`.
- The published amd64 `0.1.0-pilot.7` release still verifies with the new
  verifier on Alder. A first, stricter rule (every executable ELF) rejected
  vendored prebuilds in pi-tui and code-server. That is why only entry points
  are bound.
- **Install qualification** on an emulated arm64 VM on birch: see
  "Qualification run" below.
- Focused checks on Alder: `go test ./internal/host ./internal/cli
  ./cmd/runtime-release ./internal/daemon`, `test-host-initialization-uids.sh`
  (root container), all builder/harness Python tests, both package targets
  reproducible and verified, `validate-project-view.py`.

## Qualification run

Host: birch, stock `noble-server-cloudimg-arm64` 20260911 under QEMU TCG in a
disposable rootless container (`arm64-vm/`). Releases: predecessor
`0.0.1-arm64.1` (manifest `402613f8…`), successor `0.0.1-arm64.2`
(`2387b0e6…`), product from `aba5aacd`, dev key generated on birch.

1. **All twelve profiles** (`receipt-arm64-all-profiles-tcg.json`): connect,
   OS updates (97 packages), the ext4 quota `/home` volume, delivery and
   `host prepare` passed. `host apply` then failed with
   `runtime_package_install_deadline_exceeded`: the single apt transaction for
   every profile (texlive, ffmpeg, compilers, php, podman…) ran past the
   operator's 30-minute apt deadline under roughly 10× emulation slowdown.
   The same requirement set installs through the real apt adapter in an arm64
   container in about 3 minutes (`TestUbuntuNativeAptContainer` above).
2. **core + integrations** (`receipt-arm64-core-integrations-tcg.json`):
   connect, updates, home volume, delivery and prepare passed. **Apply
   passed**: the wrong approval was refused, a SIGKILL at `converging` was
   continued under the original approval, an exact `no_change` repeat
   followed, and public HTTPS answered 200 with the per-run CA. `first_use`
   failed on the harness's 30-second client timeout for the broker `ensure`.
   The broker completed that exchange 39 seconds after the request (account,
   binding and linger in its journal), so this is emulation speed, not a refusal.
3. On that installed host, checked by hand:
   - **`host plan` is clean**: `ready: true`, 20/20 checks pass, including
     `platform.os`, `release.manifest`, `release.runtime` and
     `installation.product`; the only action is the convergence action
     (`host-plan-arm64.json`).
   - **The daemon startup validator passed**: `open-habitat-daemon@qualone`
     started, logged `service_ready` and stayed active with no
     `server_failed`. Its `ServeHTTP` runs the trusted Pi runtime validation
     (root-owned tree walk, Pi SDK 1.3.0 manifest, `node --version` =
     v22.21.1) before serving. The runtime's Node is an aarch64 ELF, and the
     arm64 Claude SDK package is the one installed.
   - **Cold boot**: after `systemctl reboot` (new boot ID), the storage gate
     succeeded on the quota `/home`, the broker socket, gateway and both of
     qualone's sockets were active, and `host check` was ready (20/20).

Not covered on arm64: the harness's two-person first use with cross-UID
denials, the integrations catalog read, and the upgrade to the successor
(the run stops at its first failed stage). The upgrade path's arm64 bytes,
including successor descriptors and signing, were built and verified, but not
executed. The cloud qualification on real arm64 hardware remains the
proper evidence once the VM operator offers an arm64 server type, and Jari's
installation on birch (`habitat-birch-install`) will be the first real use.

## Decisions for later review

- **Per-architecture releases, not one manifest for both.** Each architecture
  has its own product package and its own signed `release.json` naming its
  platform. A multi-platform manifest would change the signed format and the
  operator's selection logic for no installation-time benefit. Consequence:
  publishing both architectures in one GitHub release needs distinct asset
  names (runtime archives are still named `<profile>.tar.gz`, and both
  architectures have a `release.json`). Fleetrepo's publisher is unchanged and
  still publishes amd64 only.
- **Architecture-neutral Ubuntu declarations** instead of a file per
  architecture, because Ubuntu publishes identical versions for both. If a
  package ever diverges, the declaration format would need a per-architecture
  override.
- **Entry-point-only ELF binding**: only `runtime/bin/*` and the editor's
  `runtime/lib/node` are bound to the release architecture. Deeper executables
  are bound only by the per-target lock digests at build time.
- **Chromium notice for arm64** comes from the same-version amd64 Chrome for
  Testing archive. The arm64 binary is Playwright's own build of the same
  Chromium revision; its third-party set may differ slightly from that notice.
- **Builds run natively per architecture** (no npm `--cpu` cross-resolution):
  arm64 core/integrations need an arm64 host such as birch.
- **`runtime-release sign --platform` is required** (no amd64 default).
- **arm64 install qualification is local TCG, not Hetzner**: the Fleetrepo VM
  operator allowlists only `cx33`/`cx43`. Adding an arm64 server type (e.g.
  `cax21`) to `open-habitat-qualification-vm` would let `cloud-qualify.py run`
  qualify arm64 releases in the cloud. That is a Fleetrepo change, not done
  here.
- **The 30-minute apt install deadline** held for real hosts but not for an
  emulated guest installing every profile at once. It is left unchanged. A slow
  real host selecting every profile could meet the same refusal; the
  documented recovery is to continue with the original approval.
- `verify-release.sh` reports a foreign-architecture package as `verified`
  with an `embedded_identity_unverified` warning rather than failing, so that
  the amd64 gate can check the cross-built package's structure.
