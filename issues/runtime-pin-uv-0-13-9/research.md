Verdict: safe-to-bump

# uv 0.12.13 → 0.13.9

Assessed on 2026-11-23 against product revision `fefaf23dd`. This is a mechanical **optional-profile** update, not a Python-profile upgrade or a change to the agent/browser protocol. Upstream has breaking CLI changes, but no product caller or contract was found that requires adaptation. The qualification steps below remain required before distributing the changed archive; this report does not claim a completed release build.

## 1. Installability and upstream changes

### Release identity and compatibility

GitHub's release and latest-release APIs both identify 0.13.9 as the current stable release: published **2026-11-17 09:57:55 UTC**, six calendar days before assessment, non-prerelease and immutable. PyPI's version metadata agrees, and none of its files is yanked. The repository remains `astral-sh/uv`; the workspace's repository and author declarations are unchanged between the two source archives. This is positive continuity evidence, not an audit of repository administrators or maintainer account security. [U1–U4]

uv is a native Rust executable, not an npm package or Node addon. The actual product runtime Node pin is **22.21.1**, regardless of the newer developer-test Node mentioned in `TESTING.md`. There is no uv Node engine constraint, npm install hook, npm signature or npm provenance requirement in this distribution path. PyPI declares Python >=3.8 and no `Requires-Dist`; that is the Python packaging channel, not a requirement to have Python installed merely to launch the standalone binary. Rust's build minimum rises from 1.96.0 to 1.98.0; the product copies upstream binaries rather than compiling uv, so this does not change its builder toolchain. [U1, U3, U5; `runtime/core/artifact-lock.json`, `scripts/uv-runtime-build.py`]

The review covered both changelogs (0.12.14–0.12.24 and 0.13.0–0.13.9), both released source archives, Cargo graphs and dependency manifests. The GitHub comparison reports 972 commits but truncates its file list to 300; a separate file-content comparison of the complete source archives found 1,216 changed/added/removed paths. This is targeted source/dependency review, not a line-by-line security audit of all those changes. [U2, U5–U7]

### Behaviour changes that matter to users

The 0.13.0 migration is the significant boundary: [U6]

- Unspecified managed-Python downloads default to **3.15**, formerly 3.14. Compatible installed interpreters are still reused. Explicit `--python 3.14` or a project's `.python-version` preserves that selection. This does **not** upgrade the product's separately locked Python 3.14.4 profile.
- Included constraints now enforce `--require-hashes` and reject editable requirements; projects relying on previously ignored directives must fix their requirements.
- Requirement-file options such as `--constraint` take one path per occurrence rather than splitting a quoted value into paths. Corresponding space-separated environment-variable lists remain supported.
- New environments on Python >=3.10 omit the distutils startup patch. Existing environments are not rewritten automatically.
- `tar-codec` becomes the default archive backend, with stricter validation and potentially different source-distribution bytes. 0.13.1 restores hard-link and full-length tar owner-name support; `UV_LEGACY_TAR_BACKEND=1` remains the documented fallback.
- `uv build --clear` refuses an output directory containing its input source. Windows ARM64 switches interpreter preference to native ARM64; that does not affect either Linux archive target.
- Cache-format changes can cause redownloads/rebuilds, increasing temporary disk use, although old and new uv versions can share a cache.

Earlier changes also matter: 0.12.14 refines error text and exit-code classification; 0.12.16 verifies index-provided artifact hashes; 0.12.22 records workspace group defaults/Python requirements; 0.12.24 rejects malformed requirement options. Product code does not parse those outputs or maintain project `uv.lock` files. There is no reason to introduce a product-wide Python override or rewrite people's project files as part of this bump. [U7; repository search of `internal/`, `runtime/`, `scripts/`]

Useful corrections include credential redaction, owner-only Unix credential files, safer uninstall and active-script environment handling, cache/concurrency fixes, and wheel-name validation. The certificate-root and chain-validation updates in 0.13.4/0.13.5 affect uv's own TLS handling; updated managed-Python download catalog entries do not repair existing environments or replace the independently pinned product Python. These are reasons to upgrade, not evidence that every Python environment becomes current. [U6]

### Targets, downloads and sizes

Both official GNU/Linux archives exist and retain the expected directory prefixes and regular `uv`/`uvx` files. Downloaded bytes matched GitHub's release-asset SHA-256 values. ELF inspection verified each target and maximum referenced glibc symbol version: x86-64 2.17, AArch64 2.28, consistent with upstream's platform policy and below the Ubuntu 24.04 baseline. Upstream calls x86-64 Tier 1 and AArch64 Tier 2; the latter is built upstream but does not receive the same test-suite guarantee. There are no Node-native-module rebuilds. [U1, U5, U8; local hash, tar and ELF inspection]

| Target/input | 0.12.13 compressed bytes | 0.13.9 compressed bytes | Candidate SHA-256 |
| --- | ---: | ---: | --- |
| linux-amd64, `uv-x86_64-unknown-linux-gnu.tar.gz` | 19,391,575 | 17,068,176 | `a7fbaff2b9a271d85c1bdb540941090fd1ce011797b4abeb48e4dcd39c2471d5` |
| linux-arm64, `uv-aarch64-unknown-linux-gnu.tar.gz` | 18,581,057 | 16,120,245 | `0797542018e541a9288855df555c8077eed06f7a47d206362030480e8ecc9f3d` |
| common `source.tar.gz` | 8,767,904 | 9,033,169 | `9ff3b8467058929c25c6be93805dd14f1ba7f35013edc8146643af0b015231c5` |

Candidate executable sizes are 38,409,000 + 331,344 bytes on amd64 and 32,432,520 + 297,672 bytes on arm64 (`uv` + `uvx`). These are **not final profile sizes**: the product also retains uv source, every registry crate and licence records. Both targets share that source closure. [U1, U5; archive inspection; `scripts/uv-runtime-build.py`]

### Licence and supply-chain assessment

The top-level MIT/Apache-2.0 licence files are byte-identical, and the workspace still declares `MIT OR Apache-2.0`. Vendored Python packaging licences move with the interpreter code into `crates/uv-python-interpreter/python/packaging/`; the product's recursive notice collection handles that location. [U5; `scripts/uv-runtime-build.py`]

The complete registry Cargo graph shrinks from **682 to 653 package identities**. There are **125 new/changed identities**, 15 previously absent crate names, and no git-sourced packages in either release. All 125 changed crate archives were fetched from `static.crates.io`, verified against the candidate Cargo.lock checksums, and their own Cargo.toml licence declarations read. None introduces a licence-expression string absent from the existing product lock, and none lacks a declaration. Unchanged identities retain their source checksums. MPL-2.0 and bundled C notices still require source/notice retention: this is not a blanket MIT bundle. [U5, U9; `runtime/profiles/uv/artifact-lock.json`]

New names are `astral-html`, `astral-ini`, `astral-mail-headers`, `asyncband`, `bytemuck_derive`, `chacha20`, `compression-codecs`, `compression-core`, `font-types`, `harfrust`, `libyaml-rs`, `rand_pcg`, `read-fonts`, `skrifa`, and `yaml_serde`. The first three replace parsing dependencies in the client, wheel installation, interpreter and requirement code; `yaml_serde` is directly used by `uv-dev`. A full Cargo.lock includes development and target-specific dependencies, so this inventory must not be described as 15 newly linked production libraries. No unexplained external installer or dependency channel was found in the inspected product path. [U5, U9]

GitHub advertises artifact attestations and the release page shows a verified tag commit. **Cryptographic attestation verification was not completed**: the available `gh` lacks `attestation`. Checksums were verified, but checksums from the same release API do not independently establish build provenance. Before release, use a capable verifier to run `gh attestation verify FILE --repo astral-sh/uv` for both target binaries and inspect their release workflow identity. The product downloads archives directly; it does not execute upstream's shell/PowerShell installer, crate build scripts, or Python package installation hooks. [U1; `scripts/download-profile-inputs.py`, `scripts/uv-runtime-build.py`]

## 2. Product update scope and proof

Update **only the uv lock and its generated release artifacts** for an implementation bump:

1. In `runtime/profiles/uv/artifact-lock.json`, set version 0.13.9, both target URLs/digests and the source URL/digest. Keep the existing target prefixes.
2. Regenerate all 653 `crates` entries from the release Cargo.lock, including filename, version, upstream URL, checksum and the published manifest's exact licence expression. Do not merely retain the old crate list or use registry latest versions. `scripts/rust-tool-lock.py` produces the different core-tool record shape; it is not a drop-in uv-lock generator.
3. Build both optional profiles through `scripts/build-profile-runtime.sh uv NEW_OUTPUT --target linux-amd64` and the corresponding arm64 command, using distinct fresh outputs. This invokes the digest-checked downloader and `uv-runtime-build.py`, retaining sources/notices, regenerating the embedded lock, component/file records, `uv.tar.gz` and `artifact.json`.
4. Regenerate the release manifest and its authenticated digest with the changed descriptors. Manifest construction must include the profile's `native-build` dependency and all selected artifacts, not just core. Do not reuse old uv archive bytes under a new version.

No npm package-lock, browser lock, web lock, Python lock, core-tool licence records or generated browser contracts change for this component. No uv source patch is carried. `internal/host/release_closure_linux.go` has exact pins for core components, but no uv-specific accepted-version constant was found; generic native-component, file, licence and architecture verification applies. The Python builder's hardcoded 3.14.4 check is unrelated and must not be changed incidentally. [Repository: `scripts/build-profile-runtime.sh`, `scripts/download-profile-inputs.py`, `scripts/uv-runtime-build.py`, `scripts/profile-runtime-build.py`, `scripts/python-runtime-build.py`, `internal/host/release_closure_linux.go`, `internal/host/platform.go`; `docs/operations.md`, “Build and verify runtime archives”]

Focused implementation checks:

- `python3 scripts/test-profile-runtime-build.py`: synthetic lock completeness, target consistency, sealing and refusal checks, including a missing Cargo member.
- Build both actual uv profiles: verifies all 653 sources, their licence declarations, binary/source digests and generated closure. Neither cross-target assembly nor source inventory proves execution on that target.
- Relevant host tests (`TestReleaseClosure`, `TestReleaseExecutableArchitecture`, `TestReleasePlatformPackages`, `TestHostReleasePlatform`) and the actual manifest writer/verifier against each target's complete artifact set.
- On each native target, disposable-home `uv --version`, `uvx --version`, explicit-Python virtualenv creation, offline installation of a synthetic local wheel, and a small locked project `sync --locked`/`run` with downloads disabled. Include the product Python 3.14 profile rather than relying only on a system interpreter.
- Qualify profile discovery and the native workflow under mapped users before advertising/distributing that capability. Existing builder tests are not this evidence; `TESTING.md` explicitly records that limitation.

## 3. Product features touched

- **Optional Python development tools:** `scripts/uv-runtime-build.py` packages `runtime/bin/uv` and `uvx`; `scripts/python-runtime-build.py` declares the Python profile's dependency on uv. Agents can manage project environments and execute Python tools, without a new browser API.
- **Install/upgrade and profile selection:** `internal/host/apply_generation_linux.go` publishes selected profile runtime paths; generic release closure and ELF validation live in `internal/host/release_closure_linux.go` and `internal/host/platform.go`.
- **Agent command discovery:** `internal/daemon/agent_path_linux.go` and its tests govern PATH and discovery of user-installed commands. The bump must not replace or rewrite a person's own uv installation/configuration.
- **Storage reporting:** `internal/daemon/storage_breakdown_linux.go` recognizes `.cache/uv`; changed upstream cache formats and rebuilds can alter reported usage but require no new accounting category.

There is no direct product dependency on uv's textual diagnostics, workspace-metadata schema, audit output or managed-Python default. That distinction makes this `safe-to-bump` rather than a required product migration, despite the upstream CLI changes. [Repository paths above; scoped uv-reference search]

## 4. New capabilities — separate proposals, not bump scope

1. **Package-change preview:** 0.12.18 adds JSON output and `--check` for `uv pip install`/`sync`. A future product preview could consume structured planned changes, but would need an explicit JSON contract, process/error handling and confirmation before a separate mutating command. A dry-run plan is not itself an authorization or race-free transaction. [U7]
2. **Read-only Python workspace inspection:** newer `uv workspace metadata` is read-only unless `--sync`, and 0.13.7 adds `--output-version`. A product inspector would need an opt-in preview policy, pinned schema decoder and fixtures; it must not silently sync environments just to show metadata. Frozen-lockfile inspection is another preview option. [U6, U7]
3. **More reproducible builds:** preview build-dependency hash enforcement and batch exports could support reproducible project export workflows. Adoption requires project-specific policy and fixtures, not global changes to users' manifests. [U6, U7]
4. **Relocated environments and specialised wheels:** 0.13.9 adds PEP 832 redirect-file support; earlier 0.13 releases develop wheel variants and CPU/GPU detection. Any product-managed use needs explicit preview enablement and filesystem/architecture qualification. Merely shipping uv does not promise accelerator availability or make redirected environments portable. [U6]

## 5. Evidence and remaining limits

Performed: source/archive digest comparisons; complete Cargo graph comparison; checksum and licence checks for all 125 changed crates; both-target binary/archive/ELF inspection; native **arm64** `uv` and `uvx` version execution; offline virtualenv creation with explicit system CPython 3.12.3; offline package listing in that empty environment. All four native commands succeeded. An initial x86-64 execution attempt on the arm64 research environment failed with exec-format error; amd64 execution remains untested, not failed qualification.

Not performed: full profile builds, complete release-manifest verification, provenance-signature verification, native amd64 execution, the shipped Python 3.14 workflow, network package resolution, or mapped-user acceptance. These are explicit implementation/release checks, not evidence of a known blocker. No candidate regression, licence change or superseding release was found in the examined sources. Recommend the mechanical bump with the focused qualification above; keep optional capability work separate.

Report validation: `python3 scripts/validate-project-view.py` and `git diff --check` passed. No pin or lock changed in this research run.

## Sources

Upstream sources retrieved on 2026-11-23:

- **U1:** [0.13.9 release metadata and asset digests](https://api.github.com/repos/astral-sh/uv/releases/tags/0.13.9), [release notes and attestation instructions](https://github.com/astral-sh/uv/releases/tag/0.13.9).
- **U2:** [0.12.13 release metadata](https://api.github.com/repos/astral-sh/uv/releases/tags/0.12.13), [version comparison](https://github.com/astral-sh/uv/compare/0.12.13...0.13.9).
- **U3:** [PyPI 0.13.9 registry metadata](https://pypi.org/pypi/uv/0.13.9/json).
- **U4:** [GitHub latest-release metadata](https://api.github.com/repos/astral-sh/uv/releases/latest) (time-sensitive).
- **U5:** [0.13.9 released source](https://github.com/astral-sh/uv/releases/download/0.13.9/source.tar.gz), [0.12.13 released source](https://github.com/astral-sh/uv/releases/download/0.12.13/source.tar.gz): Cargo.toml, Cargo.lock, licence files and relevant crate manifests.
- **U6:** [0.13 changelog at the candidate tag](https://github.com/astral-sh/uv/blob/0.13.9/CHANGELOG.md).
- **U7:** [0.12 changelog at the candidate tag](https://github.com/astral-sh/uv/blob/0.13.9/changelogs/0.12.x.md).
- **U8:** [Candidate platform policy](https://github.com/astral-sh/uv/blob/0.13.9/docs/reference/policies/platforms.md).
- **U9:** Published crate archives at `https://static.crates.io/crates/NAME/NAME-VERSION.crate`, with identities/checksums taken from [candidate Cargo.lock](https://github.com/astral-sh/uv/blob/0.13.9/Cargo.lock); licence declarations read from each archive's `NAME-VERSION/Cargo.toml`.
