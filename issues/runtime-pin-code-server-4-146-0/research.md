Verdict: safe-to-bump

# code-server 4.145.2 → 4.146.0

Assessed 2026-11-23 against product commit `955512e5d336a857b5e66cc6a270e6d9ae235c19`. This is a mechanical **standalone editor archive** update, not an npm installation. Both candidate archives passed the existing normalization/sealing builder with a scratch-only candidate lock. No product contract adaptation was identified. This verdict is not installed-host or browser qualification.

## 1. Installability and upstream changes

### Compatibility

The release advances Code 1.145.2 to 1.146.0. The source comparison contains 19 commits: in addition to the Code update, it adds `--wait`, makes exact trusted-origin comparisons case-insensitive, fixes Windows proxy URL splitting, and changes build/publication infrastructure. None removes the socket, authentication, cache or idle flags used by Open Habitat. The existing standalone launcher is byte-identical. [U1–U3; R1]

The significant packaging break is **source builds switching from npm to pnpm**, with npm shrinkwraps removed. Installing the npm package can therefore resolve a dependency tree different from the release-tested one. This does not affect the product's exact, SHA-256-locked platform tarballs: they contain their dependencies and Node, and the product neither installs npm dependencies nor runs their postinstall scripts. Upstream now includes pnpm locks/workspace files; the product builder retains them without interpreting them. [U1–U4; R2]

Both registry versions declare Node `24`. The product core lock actually pins Node **22.21.1**, notwithstanding the different development-tool version in TESTING.md. Do not run code-server with that core Node. The editor's own `bin/code-server` selects `lib/node`; its executable aliases also use that bundled binary. Candidate arm64 Node reported **v24.22.1**. The normalized arm64 launcher reported `4.146.0 9cc1033c190703416bbd5ec95d8f7db9f3edb63d with Code 1.146.0`. No core Node bump is needed. [U4; archive inspection; R2–R3]

### Supply chain and licences

- Published **2026-11-20 19:06:43 UTC**, approximately 2 days 18 hours before inspection. GitHub's latest-release endpoint still returned `v4.146.0`; it was not marked prerelease or draft. The new release is immutable, unlike 4.145.2. Both candidate download hashes matched GitHub's asset digests. [U2]
- Registry metadata retains the same repository, maintainer list, MIT declaration, direct dependency ranges and `sh ./postinstall.sh` lifecycle entry. The source diff changes the OS-package maintainer contact, not the repository owner. Publication switches to OIDC, an application-backed publisher, build attestations and a second approval; these are positive provenance signals, not proof of harmless code. [U3–U4]
- Both npm versions expose registry signatures using key ID `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. Only the candidate metadata exposes a provenance attestation. Its retrieved statement names `coder/code-server`, `.github/workflows/publish.yaml`, tag `v4.146.0`, and commit `9cc1033c190703416bbd5ec95d8f7db9f3edb63d`; its subject SHA-512 agrees with npm integrity metadata. These signatures/attestations were **inspected, not cryptographically verified**. The available GitHub CLI lacks `attestation verify`. npm provenance covers the npm package, not these platform archives. [U4–U5]
- Top-level `LICENSE` and `ThirdPartyNotices.txt` are byte-identical between old amd64 and both candidates. Comparing all corresponding licence/notice/copying files in old/new amd64 found **no changed content**. Newly located licence files accompany hoisting or ordinary dependencies; they do not introduce a new observed licence family. This is an inventory comparison, not a blanket MIT licence for the bundle. Existing Copilot terms and nested notices remain applicable. [U2, downloaded archives]
- Direct dependencies are unchanged, but bundled transitive versions move: Express 5.2.1→5.3.0, ws 8.21.0→8.23.0, argon2 0.45.1→0.45.2, vscode-jsonrpc 8.2.1→10.0.0, and proxy-agent 0.45.0→0.46.0. Copilot Chat moves 0.73.0→0.74.0 and the already-present Copilot SDK moves from `1.0.27-unstable.41379698026.g3219c66` to `1.0.30-preview.0`. New named packages in the amd64 inventory are `has-flag` and `supports-color` (MIT); several apparent additions are merely hoisting changes. No unexpected new direct dependency was found. Retain nested notices, not just the two top-level files. [U2, archive package.json inventories]

### Both archive targets

| Target | 4.145.2 compressed bytes | 4.146.0 compressed bytes | Candidate regular-file bytes before normalization |
| --- | ---: | ---: | ---: |
| linux-amd64 | 236,495,502 | 266,502,310 | 750,407,809 |
| linux-arm64 | 233,639,045 | 266,539,939 | 726,894,244 |

Download growth is about 30 MB/33 MB respectively. Candidate SHA-256 values, independently computed after download:

```text
linux-amd64 cf7e82ca5fe1df664d43a43d900c3c9710f8f3403a5e8d0e18f6a12d10d7401b
linux-arm64 3df88f7f1feecce3583ab0109c5f6bf14f90ae3a44939b4257ccd9850ef37a6e
```

Each target has its own upstream tarball, bundled Node and native modules: argon2, node-pty, kerberos, watcher, spdlog, sqlite3, native-watchdog and Copilot runtimes. Large Copilot native payloads remain in both trees. Some Windows extension binaries are also bundled; do not assume every embedded executable has the host architecture. Both candidates contain 12 executable file symlinks, not pnpm directory aliases that the product builder would reject. Both normalized successfully without changes. No per-target download or native-module compilation happens during product installation. Native execution on amd64 was not established; an attempted amd64 Node invocation on the arm64 research environment correctly failed with an executable-format error. [U2; R2; archive inspection]

## 2. Bump scope and proving checks

Change only the version and both target URLs, prefixes and SHA-256s in `runtime/profiles/editor/artifact-lock.json`. Rebuild each editor archive, regenerating its `artifact.json`, component/file digests, retained artifact lock and licence inventory; include the new descriptors when generating `release.json` and its independently approved digest. Preserve the upstream nested licence files and pnpm locks automatically copied by the builder. [R2; R4]

**Not required:** changes to core/integrations npm package-locks, the web lock, browser-lock.json, Rust Cargo/crate licence records, or accepted core-tool version constants. Editor is a native component derived from its artifact lock; there is no hard-coded 4.145.2 acceptance constant in the verifier. No Open Habitat source patch is applied to code-server. Its launcher/alias normalization and the product's built-in editor extension remain; upstream carries its own VS Code patches, including the file-cache patch the product uses. Do not confuse those with the unrelated core bridge patch. [R1–R4; U3]

Evidence obtained here:

- Downloaded both candidate tarballs and old amd64; checked candidate SHA-256s against release metadata and inspected package/notice inventories.
- Invoked `scripts/editor-runtime-build.py` with a candidate lock **outside the repository** for both targets: passed, including link normalization, required notices and sealing.
- Ran normalized arm64 `bin/code-server --version` and `--help` in a disposable home: passed; required socket/cache/idle/reconnection options remain present.
- `python3 scripts/test-profile-runtime-build.py`: 16 tests passed.
- `python3 scripts/validate-project-view.py`: passed. `git diff --check`: passed before commit.

For the actual bump, run `scripts/build-profile-runtime.sh --target linux-amd64 editor NEW_OUTPUT` and the arm64 equivalent, then the release manifest/verify path with the selected core, integrations and editor descriptors. Run affected host closure/platform tests and focused daemon/gateway editor tests via `scripts/test-focused.sh --area go --go-package ...`; run `web/tests/workspace-editor.spec.ts` through the focused browser runner. These check product contracts but use stand-ins for code-server. Also smoke-test the real candidate on both native architectures: Unix-socket startup, health, workbench/WebSocket connection, open/save, built-in file-open extension, reconnect and idle shutdown. A mapped-user editor journey remains release qualification under docs/operations.md; this research did not run one. [R1–R5]

## 3. Product features touched

- Workspace VS Code editor: `internal/daemon/editor_linux.go` starts/stops it under the person's UID, constructs flags/environment, probes health and relays traffic; `editor_settings_linux.go` seeds native preferences.
- Browser isolation and editor sessions: `internal/gateway/editor_linux.go`, `editor_bridge.js`, and `web/src/app/WorkspaceEditor.tsx` / `editor.ts` implement the separate origin, session grant, framing and reconnect behavior.
- Conversation file links and editor navigation: `internal/daemon/editor-extension/extension.js` is injected alongside upstream built-ins.
- Runtime selection: `internal/host/apply_generation_linux.go` writes the selected editor launcher path; the profile builder and release closure authenticate its bytes.

This does not replace Pi, the native terminal, or the separate lightweight browser file editor. [R1–R5]

## 4. New capabilities — proposals only

1. **Waiting editor for Git/terminal commands:** upstream `--wait` now reaches the existing-instance CLI and waits for file closure. A future opt-in `EDITOR`/`GIT_EDITOR` integration could use it. It needs correct instance/workspace routing, no-window errors, cancellation and lifecycle tests; do not silently set people's environment during the bump. [U1; U3]
2. **Evaluate selected Code 1.146 agent features separately:** upstream advertises experimental inbox mode, model comparison, chat windows and preview MCP-provided skills. Those are VS Code/Copilot features, not demonstrated code-server or Pi capabilities. Supporting them as product features would require browser-build availability checks, provider entitlement, permission/privacy review and explicit decisions about how native sessions relate to the product. Recommend no automatic integration or default enablement. [U6; R1]

## Sources

Upstream sources retrieved 2026-11-23:

- U1: `https://github.com/coder/code-server/releases/tag/v4.146.0`
- U2: GitHub release API and the target archives it names: `https://api.github.com/repos/coder/code-server/releases/tags/v4.146.0`, equivalent `v4.145.2` endpoint, and `https://api.github.com/repos/coder/code-server/releases/latest`.
- U3: `https://api.github.com/repos/coder/code-server/compare/v4.145.2...v4.146.0` — reviewed source patches, not only release notes. VS Code submodule moves `c4453f8ea430795f941c1b2ff6c9321135a74a02` → `69047191fc427f2f92828279aae1d90d8eeda7ab`; the complete VS Code source diff was not audited.
- U4: `https://registry.npmjs.org/code-server/4.145.2` and `https://registry.npmjs.org/code-server/4.146.0`.
- U5: `https://registry.npmjs.org/-/npm/v1/attestations/code-server@4.146.0`.
- U6: `https://code.visualstudio.com/updates/v1_146`.

Repository sources at the commit above:

- R1: `internal/daemon/editor_linux.go`, `editor_settings_linux.go`, `editor-extension/extension.js`, and corresponding editor tests.
- R2: `runtime/profiles/editor/artifact-lock.json`, `scripts/editor-runtime-build.py`, `scripts/build-profile-runtime.sh`, `scripts/download-profile-inputs.py`, `scripts/profile-runtime-build.py`.
- R3: `runtime/core/artifact-lock.json`, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`.
- R4: `internal/host/release_closure_linux.go`, `apply_generation_linux.go`, and docs/operations.md, “Build and verify runtime archives”.
- R5: `TESTING.md`, `scripts/test-profile-runtime-build.py`, `internal/gateway/editor_linux.go`, `editor_bridge.js`, `web/src/app/WorkspaceEditor.tsx`, `editor.ts`, `web/tests/workspace-editor.spec.ts`.
