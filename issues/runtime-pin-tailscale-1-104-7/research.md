Verdict: safe-to-bump

# Tailscale 1.104.4 → 1.104.7

Researched 2026-11-23 against repository commit `136cfe997458a9ba5d6eb782376b5a47b4b40223`. This is a recommendation for a mechanical bump, **not build or deployment acceptance**. No pin was changed.

## 1. Installability and upstream changes

The GitHub latest-release API and official stable package index still identify **1.104.7** as stable. It was published **2026-11-12 at 22:56:51 UTC**, about eleven days before this assessment; it is neither a draft nor a prerelease. Both required Linux archives are available. [U1, U2]

The public comparison contains 18 commits. Relevant changes are:

- 1.104.5 fixes userspace TCP stalls on lossy links and Tailscale SSH approval-expiry, shutdown and background-job handling.
- 1.104.6 fixes a dormant-connection problem, updates WireGuard handshake handling, and adds opt-in suspension/resumption for slow IPN bus subscribers.
- 1.104.7 moves the bundled Go runtime from 1.27.3 to **1.27.4** to fix control-plane TLS ClientHello interoperability. Its Kubernetes proxy identity fix affects the operator, which this product does not ship.
- The diff also retries certain transient UDP receive failures and bounds LocalAPI DNS requests with their caller context. [U3, U4]

No CLI/configuration migration was found for the product's `tailscale nc`, status/prefs/login/logout calls, userspace daemon arguments or locked configuration. **There is a transport-default change:** RACK TCP loss recovery is disabled again. Read the executable code in `wgengine/netstack/netstack.go`, not the newly added knob's stale comment saying RACK remains enabled. The override is `TS_NETSTACK_ENABLE_RACK=true`; retain upstream's default in the bump. This is relevant to userspace networking, but requires no product adaptation. Lossy-path stalls improve at the potential cost of reordered-path throughput. Tailscale SSH server process-lifetime changes do not change Habitat's ordinary OpenSSH client sessions: the local Tailscale SSH server is disabled. [U4; `internal/daemon/own_machines_linux.go`, especially `tailscaledArgs`, `tailnetConfig`, `machineConfig`]

### Runtime and both targets

These are **static Go ELF executables**, not npm packages or native Node addons. Both downloaded targets embed Go 1.27.4; `file` identifies x86-64 and AArch64 respectively. There is no Node engine requirement, dynamic libc dependency or npm lifecycle script introduced by these binaries. The actual core/integrations locks in this checkout pin Node **22.21.1**; the different development Node named by `TESTING.md` is not the shipped lock. Neither needs changing for Tailscale. Source builds require Go 1.27.4, but Habitat extracts prebuilt executables rather than compiling Tailscale. [U4, U5; `runtime/core/artifact-lock.json`, `runtime/profiles/integrations/artifact-lock.json`, `scripts/integrations-runtime-build.py`]

Measured downloads and archive members (bytes):

| Target | Compressed 1.104.7 | Change from 1.104.4 HTTP length | `tailscale` | `tailscaled` |
|---|---:|---:|---:|---:|
| linux-amd64 | 41,386,551 | −8,783 | 34,348,797 | 43,937,816 |
| linux-arm64 | 38,069,792 | +49,356 | 31,913,193 | 40,986,698 |

Both archives contain the two executables and upstream systemd files, with no extra installer program. Habitat extracts only locked executable members and generates its own per-user unit; do not install upstream's host-wide service. These sizes are upstream downloads, not predictions of the rebuilt integrations archive's compressed size. [U5; `scripts/integrations-runtime-build.py`, `internal/daemon/own_machines_linux.go`]

SHA-256 measured locally and matched against each official `.sha256` response:

| File | SHA-256 |
|---|---|
| `tailscale_1.104.7_amd64.tgz` | `e56693ff74a64f2591b7e819c280635a100aae1ddfb0ef058fcd052b7cd8d16c` |
| `tailscale_1.104.7_arm64.tgz` | `d6bed2720310b328b861f943d7b4016c5358a9bad60575eb51e8143b79068484` |
| amd64 `tailscale` | `6ff883f468ded6221ba16a34c09cbf8ba4488bf889bf6575e040684677e1a02c` |
| amd64 `tailscaled` | `38f0ffb0f156ca3ebad33c420bea626933e877be54c38c66cfa155dfa84540af` |
| arm64 `tailscale` | `362426a7417d85879cb76ae767375b1e839996cc63d5d2ebccd5b8bfdc736ec8` |
| arm64 `tailscaled` | `bd34e19b71fdbb11a6e603ac69af5e4d360ea983d0d9f93ff0a7210afff52ad5` |

### Licence and supply-chain assessment

The upstream BSD-3-Clause LICENSE is byte-identical between these tags. Comparing the **embedded module lists of all four downloaded binaries** with the checked-in notices found only the main-module/toolchain changes and, in `tailscaled`, one dependency revision: `github.com/tailscale/wireguard-go` moves from `417aef361226` to `9e0ab45c16ca`. Its MIT LICENSE is byte-identical; the Go 1.27.3/1.27.4 LICENSE is also byte-identical. No new dependency, replacement or changed module set appeared; each tool has identical module records across architectures. Existing bundled dependencies retain their own notices and obligations, not a blanket BSD licence. Full notice regeneration and checksum-database verification remain bump acceptance work. [U4, U6; `scripts/go-binary-notices.py`, both checked-in Tailscale notices]

Distribution remains `tailscale/tailscale` plus `pkgs.tailscale.com`; no repository move or release-publisher change was observed between the two release tags. This does not audit all maintainer permissions. Npm registry signatures and npm provenance are **not applicable**. GitHub lists no release assets; these tarballs are on the official package server. Same-origin SHA-256 sidecars establish byte consistency, not independent publisher authentication. No independently verified artifact provenance attestation was established in this research. [U1, U2, U5, U7]

Both old and new annotated tags contain SSH signatures, but GitHub reports `verified: false, reason: unknown_key` for each. Do not describe them as verified signatures. The new tag object is `fb3b9b2964ace04490fbd65d4f26a0eaf362131f`, pointing to source commit `cbc74fe48ef1b1649f69a4d9a602319427e25102`; the arm64 binaries' version output names the tag-object hash as their Tailscale commit. That distinction explains the apparent difference from the comparison's head commit. No new trust-channel regression was found relative to the existing pin. [U7; native version observations]

## 2. Mechanical bump scope and proof

Change together:

1. `runtime/profiles/integrations/artifact-lock.json`: both archive filenames/URLs/SHA-256s, and all four tool entries' versions, archive names, member paths and executable SHA-256s. `tailscale` and `tailscaled` must remain at the same version on both targets.
2. Regenerate `tailscale-THIRD-PARTY-NOTICES` and `tailscaled-THIRD-PARTY-NOTICES` with `scripts/go-binary-notices.py generate --out ...`, supplying both target binaries for each tool. Do not merely edit version strings: the generator checks module sums and retains licence texts. Use a disposable Go **1.27.4 or newer** toolchain for generation: it sets `GOTOOLCHAIN=local`, and the downloaded main module now requires 1.27.4. The documented development Go 1.27.1 is not sufficient for that generation step. Run `check` for each binary afterward.
3. Raise accepted versions in `internal/host/integrations_linux.go`, corresponding fixtures in `internal/host/integrations_linux_test.go`, and version expectations in `scripts/test-integrations-runtime.py`.
4. Rebuild integrations for each target, regenerating `artifact.json`, file/component/notice inventories, archive digest and the release manifest. Use native builders for each architecture; preserve the existing complete core+integrations manifest closure. [Repository sources above; `runtime/profiles/AGENTS.md`, `TESTING.md`, `docs/operations.md` §Build and verify runtime archives]

No npm package/package-lock, browser lock, Cargo lock/crate licence record, application Go module dependency, Ubuntu requirement or core agent-tool version change is called for. There is no carried Tailscale source patch: the builder extracts pinned bytes. The integrations builder's Microsoft package patch is unrelated and must remain unchanged. [`scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py`]

Focused acceptance for the subsequent bump:

- `python3 scripts/test-profile-runtime-build.py`: target selection, same-version lock invariants and builder refusals.
- Notice `generate` and `check` as above, then `scripts/build-profile-runtime.sh --target TARGET integrations NEW_ABSOLUTE_OUTPUT_DIRECTORY` on both native targets; separately run `python3 scripts/test-integrations-runtime.py PROFILE_OUTPUT CORE_RUNTIME_DIRECTORY`, where the second argument contains the matching built core's `node_modules`.
- Host release-closure/integrations tests (through `scripts/test-focused.sh --area go --go-package ./internal/host`) and manifest generation/verification against both actual built archives. These prove exact accepted versions, architecture, digests and inventory, not connectivity.
- Daemon own-machine tests through the focused Go runner, plus `scripts/test-tailscale-uids.sh` against the changed pin: this is the important real-binary foreign-UID LocalAPI denial and locked-shields-up check. Run on each target's native host. It is networkless and does not prove real peer connectivity or installed systemd lifecycle.
- `scripts/test-focused.sh --area browser --spec own-machines.spec.ts` for the existing connect/status/grant/disconnect UI. A disposable tailnet smoke test of outbound OpenSSH over `tailscale nc` is useful release qualification, especially for lossy/reordered paths; neither mocks nor version output prove it. [`TESTING.md`, named scripts and tests]

## 3. Product features touched

**Own machines** is the direct consumer. `internal/daemon/own_machines_linux.go` runs the per-user userspace node, connects/disconnects it, reads LocalAPI status/preferences, creates SSH grants and pinned-host-key configuration, and probes outbound SSH via `tailscale --socket=... nc`. Its private runtime directory and locked `ShieldsUp`, disabled DNS/routes, disabled SSH server and disabled web client remain unchanged. `web/src/app/OwnMachines.tsx` and `web/src/components/OwnMachines.tsx` present this workflow. `internal/daemon/ssh_config_linux.go` consumes the SSH configuration; `internal/daemon/disconnect_all_linux.go` and `internal/gateway/removal_linux.go` cover disconnect/account-removal cleanup. `internal/host/integrations_linux.go` enforces shipped-tool closure. These paths benefit from transport/control-plane reliability fixes without a browser contract change.

## 4. New capabilities, separate from the bump

The source diff adds **opt-in resumable IPN notifications** (`NotifySuspendWhenBehind`, suspended notifications and `resume-ipn-bus`). Habitat currently polls status rather than subscribing. A possible future own-machines live-status feature would need a daemon-owned LocalAPI watcher, suspension/resumption and reconnect handling, cancellation on disconnect, bounded event delivery, and UI/contract tests. It is not required for this bump and is not automatically enabled by installing it. [U4; `internal/daemon/own_machines_linux.go`]

The RACK override is a diagnostic tuning option, not a feature to expose routinely. Adding an operator control would require performance evidence and an explicit supported configuration decision. Do not enable inbound Tailscale SSH, Serve, a proxy listener or Kubernetes functionality as part of the update. No other new product capability is justified by this patch interval. [U4; `tailnetConfig`]

## 5. Verdict and evidence limits

**Safe-to-bump:** both official artifacts are available, the observed licence/dependency delta is narrow, and existing product interfaces need no adaptation. The RACK default is an upstream transport fix, not a new product contract. The remaining work is locks, notices, accepted-version constants and the focused checks above. No feature work is bundled into the recommendation.

Performed here: upstream release/tag/comparison and changelog review; both target downloads and checksum comparisons; tar inventories, ELF architecture/static-link inspection, embedded-module comparisons and changed licence comparisons; native arm64 `tailscale version` and `tailscaled --version` (both 1.104.7, Go 1.27.4). An amd64 execution attempt was rejected with an exec-format error on the arm64 research environment; amd64 execution is **not verified**. No daemon was started and no live tailnet was used. Full regenerated notices, archive builds, UID isolation, browser and live-connectivity tests were **not run** in this research-only change. Report validation: `python3 scripts/validate-project-view.py` and `git diff --check`.

## Sources

Upstream URLs were retrieved on 2026-11-23. Archive sizes, hashes, ELF and module observations above are measurements of U5, not release-note assertions.

- **U1:** [Release](https://github.com/tailscale/tailscale/releases/tag/v1.104.7), [latest-release metadata](https://api.github.com/repos/tailscale/tailscale/releases/latest).
- **U2:** [Official stable package index](https://pkgs.tailscale.com/stable/).
- **U3:** [Changelog](https://tailscale.com/changelog), entries dated 2026-11-02, 2026-11-10 and 2026-11-12.
- **U4:** [Complete source comparison](https://github.com/tailscale/tailscale/compare/v1.104.4...v1.104.7), [comparison API with patches](https://api.github.com/repos/tailscale/tailscale/compare/v1.104.4...v1.104.7).
- **U5:** [amd64 archive](https://pkgs.tailscale.com/stable/tailscale_1.104.7_amd64.tgz), [amd64 checksum](https://pkgs.tailscale.com/stable/tailscale_1.104.7_amd64.tgz.sha256), [arm64 archive](https://pkgs.tailscale.com/stable/tailscale_1.104.7_arm64.tgz), [arm64 checksum](https://pkgs.tailscale.com/stable/tailscale_1.104.7_arm64.tgz.sha256). Baseline lengths came from HEAD requests to the corresponding 1.104.4 URLs.
- **U6:** [Tailscale licence](https://raw.githubusercontent.com/tailscale/tailscale/v1.104.7/LICENSE), [WireGuard dependency licence](https://raw.githubusercontent.com/tailscale/wireguard-go/9e0ab45c16ca/LICENSE), [Go licence](https://raw.githubusercontent.com/golang/go/go1.27.4/LICENSE); compared byte-for-byte with v1.104.4, 417aef361226 and go1.27.3 respectively.
- **U7:** [New tag reference](https://api.github.com/repos/tailscale/tailscale/git/ref/tags/v1.104.7), [annotated tag and verification metadata](https://api.github.com/repos/tailscale/tailscale/git/tags/fb3b9b2964ace04490fbd65d4f26a0eaf362131f), [old tag reference](https://api.github.com/repos/tailscale/tailscale/git/ref/tags/v1.104.4) (followed to its annotated tag).
