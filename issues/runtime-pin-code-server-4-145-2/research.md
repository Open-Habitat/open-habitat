Verdict: safe-to-bump

# code-server 4.141.0 → 4.145.2

Assessed 2026-11-13 against product revision `d0c14e29`. This is a mechanical editor artifact update, not an npm installation or a core Node upgrade. No required product adaptation was identified. Keep the existing launch flags and security boundary; new optional capabilities are separate work. This verdict is not release or mapped-user qualification.

## 1. Installability and upstream changes

### Compatibility

The [release](https://github.com/coder/code-server/releases/tag/v4.145.2) updates the embedded Code workbench to 1.145.2. The [49-commit comparison](https://github.com/coder/code-server/compare/v4.141.0...v4.145.2) and [tagged changelog](https://github.com/coder/code-server/blob/v4.145.2/CHANGELOG.md) include:

- Code 1.143.1, 1.144.0 and 1.145.x updates; upstream rebases its workbench patches, including base paths, webviews, remote storage and extension integration.
- Bundled Node 24.21.0 → 24.22.1. Upstream identifies a Brotli decoder security fix (CVE-2026-111497) and disables decompression of incoming compressed JSON/form bodies. Such requests now fail rather than being inflated. This is a deliberate behavior change, but Open Habitat has no compressed editor JSON/form request contract to adapt.
- Boolean `false` handling and tilde expansion fixes in configuration, socket-fd activation repairs, cookie-domain fixes, default-port normalization and `X-Forwarded-Port` support in WebSocket origin checks.
- HttpOnly cookies and removal of the code-server session cookie from its built-in WebSocket proxy, matching its existing HTTP proxy behavior.

Both published npm versions declare Node `24`. Core and integrations actually pin Node **22.21.1** in their artifact locks; the development Node version in TESTING.md is not that runtime pin. Installing this npm package into core would therefore be inappropriate, but the editor profile already uses standalone tarballs containing their own Node. Its launcher is byte-identical between the downloaded old/new amd64 packages; `scripts/editor-runtime-build.py` also makes executable aliases use bundled Node. No core engine change is needed. Native arm64 execution reported Node `v24.22.1` and code-server `4.145.2` with Code `1.145.2`.

Sources: [old package metadata](https://registry.npmjs.org/code-server/4.141.0), [new package metadata](https://registry.npmjs.org/code-server/4.145.2), [pinned Node version](https://github.com/coder/code-server/blob/v4.145.2/.node-version), `runtime/core/artifact-lock.json`, `runtime/profiles/integrations/artifact-lock.json`, `scripts/editor-runtime-build.py`.

### Licence and dependencies

The root licence remains MIT. `LICENSE` and `ThirdPartyNotices.txt` are byte-identical between the downloaded 4.141.0 amd64 and both 4.145.2 Linux archives. That is not a blanket MIT licence for the whole bundle: dependency-specific licences still apply, including the existing bundled Copilot components.

An archive inventory compared 372 old and 374 new amd64 named package manifests. No retained package path changed its declared licence. Newly present package paths are `libsodium`/`libsodium-wrappers` (ISC), `@hpke/common`/`@hpke/core` (MIT), and nested `js-yaml/node_modules/argparse` (PSF-2.0); each has a supplied licence file. Existing licence/notice files have unchanged bytes; five new licence files appear and two old paths disappear with dependency layout changes. These are permissive additions, not a detected redistribution restriction. The cryptographic packages are explained by the embedded [Code source package manifest](https://github.com/microsoft/vscode/blob/c4453f8ea430795f941c1b2ff6c9321135a74a02/package.json), which directly declares `@hpke/core` and `libsodium-wrappers`.

At code-server's own package level there are no new direct runtime dependency names: argon2 changes from `^0.44.0` to `^0.45.1`, and a `basic-ftp: ^6.2.1` override is added. The upstream npm lock also updates YAML, HTTP/proxy and development dependencies. Its new entries are nested argparse and a development-only ESLint core package; no `hasInstallScript` flags change. This inspection is a manifest/licence-file comparison, not an exhaustive legal audit of every embedded source or vulnerability scan.

Sources: [package diff and lock](https://github.com/coder/code-server/compare/v4.141.0...v4.145.2), [old assets](https://github.com/coder/code-server/releases/tag/v4.141.0), [candidate assets](https://github.com/coder/code-server/releases/tag/v4.145.2).

### Supply chain

At inspection, the [GitHub latest-release endpoint](https://api.github.com/repos/coder/code-server/releases/latest) still selected 4.145.2, published **2026-11-07 01:28:11 UTC**, about six days old; it was neither a prerelease nor superseded. The npm version was published at 01:39:06 UTC the same day. Both version records retain the same maintainer list and `coder/code-server` repository URL. No ownership change was apparent in those records; this is not an independent audit of publisher account access.

Both versions advertise npm registry ECDSA signatures. All returned signatures verified locally over `code-server@VERSION:INTEGRITY` against the matching key from the [npm registry keys endpoint](https://registry.npmjs.org/-/npm/v1/keys). Neither version's `dist` metadata contains an `attestations` record: **no npm provenance attestation was established**. Registry signatures authenticate registry metadata, not the GitHub tarball build process. Both retain the same `postinstall: sh ./postinstall.sh`; Open Habitat downloads/extracts standalone release archives and does not execute that npm lifecycle script. The GitHub assets were downloaded over HTTPS and hashed locally; no independent signed GitHub build provenance was verified.

### Both archive targets

| Target | 4.141.0 compressed bytes (release metadata) | 4.145.2 compressed bytes (downloaded) | Candidate member bytes, before normalization |
| --- | ---: | ---: | ---: |
| linux-amd64 | 239,926,515 | 236,495,502 | 710,834,024 |
| linux-arm64 | 234,587,826 | 233,639,045 | 675,891,723 |

Candidate SHA-256 values, computed from the downloaded official assets:

- `code-server-4.145.2-linux-amd64.tar.gz`: `2f6db6c3e8b733dd6b3aeee83532e148b2bae2e392353ba85452d03572348962`
- `code-server-4.145.2-linux-arm64.tar.gz`: `e867a34416e2da4a83496b09580001893e7a4e5bb58a0624c4fcd22819e7d53d`

These are separate architecture-specific distributions, not one portable npm tree. Candidate archives contain 16 amd64 and 15 arm64 `.node` members (including duplicate build outputs and bundled foreign-platform extension files), with native argon2, node-pty, watcher, sqlite3, spdlog, kerberos and Copilot components. Old amd64 also had 16; no new amd64 addon path family appeared. Embedded ripgrep and Node also need the target-specific artifact. Do not rebuild native addons against core Node or reject all foreign-platform auxiliary files indiscriminately (`internal/host/platform_linux_test.go` explicitly covers this distinction).

## 2. Bump scope and proof

Only the editor pin input needs editing: `runtime/profiles/editor/artifact-lock.json`, updating the common version and **both** URLs, extraction prefixes and SHA-256s. Rebuild each target with `scripts/build-profile-runtime.sh --target TARGET editor NEW_ABSOLUTE_OUTPUT_DIRECTORY`. The builder retains the upstream tree and notices, copies the input lock, normalizes links and seals a new `editor.tar.gz` plus `artifact.json` with complete file digests/modes and component records. Generate and verify the release manifest against those new descriptors; old archive/manifest hashes cannot be reused.

There is **no editor npm package-lock to regenerate**: upstream's packaged dependency bytes come from the pinned tarball. Leave core/integrations npm locks, Rust tool crate/licence records, core browser lock, browser-profile wheel lock and web package-lock untouched. The editor has no hard-coded accepted 4.141.0 version constant in the host verifier; `CoreAgentTools` is unrelated. The editor builder carries alias normalization, not a source patch against code-server. The embedded Open Habitat extension in `internal/daemon/editor-extension/` is supplied at launch, not a patch to upstream. Upstream's own workbench patches already ship in its release.

Focused checks for the bump:

1. `python3 scripts/test-profile-runtime-build.py` for lock target/version agreement, sealing and aliases; build both editor targets and verify their descriptors/archives through `runtime-release manifest` and the release verifier as documented in `docs/operations.md`.
2. `go test ./internal/host -run 'TestReleaseClosure|TestReleaseExecutableArchitecture|TestReleasePlatformPackages'` for relevant closure/architecture rules, with repository test prerequisites. These synthetic checks do not establish the real editor's functionality.
3. Focused daemon and gateway editor tests (through `scripts/test-focused.sh --area go --go-package ./internal/daemon` and `./internal/gateway`) for lifecycle, private socket, relay, cookies and origin refusal. Test code-server itself on each native architecture with production flags, health response, workspace open, terminal/native addon use and reconnect.
4. Relevant browser specs `workspace-editor.spec.ts` and `en-shell-editor.spec.ts`, using the focused runner. Stand-in editor fixtures alone cannot qualify the updated Code workbench; additionally exercise the real packaged editor's iframe, file-opening extension, webviews and logout/reconnect path. Mapped-user acceptance remains installation qualification, not inferred from same-UID tests.

Research checks actually performed:

- Downloaded both candidate archives and old amd64; old amd64 digest matches the checked-in lock. Enumerated archive manifests, native addons and licence files.
- Ran the **real editor normalization/sealing function for both candidate targets** with a scratch-only copy of the proposed lock: both succeeded without source changes. This was not a complete release manifest build.
- Ran candidate arm64 `--version`; started it with current production flags except the product's custom builtin-extension directory, observed a mode-0600 Unix socket and HTTP-success `/healthz` response (`expired`, expected without a workbench heartbeat). Terminated the synthetic process group. This proves startup, not workspace/native-extension behavior.
- An attempted amd64 execution returned `Exec format error` on the non-amd64 research machine; amd64 native execution is **not verified**. No emulator result is claimed.
- Verified registry signatures as above. `python3 scripts/validate-project-view.py` and `git diff --check` passed for this report. No full gate, browser journey, host deployment or mapped-user test was run for this report-only task.

## 3. Product features touched

- Workspace editor launch, stop, health/idle/reconnection and per-person native data: `internal/daemon/editor_linux.go`, `editor_settings_linux.go`; generation binary selection: `internal/host/apply_generation_linux.go`.
- Dedicated editor origin, short-lived grant, cookie boundary, HTTP/WebSocket relay and logout: `internal/gateway/editor_linux.go`, `editor_bridge.js`. Its header allowlist excludes arbitrary forwarded headers/cookies, drops upstream Set-Cookie, and the daemon removes Origin after the gateway's exact-origin check. The upstream proxy-cookie/origin fixes do not replace or require weakening those controls.
- Embedded workbench, readiness/reconnect and file navigation: `web/src/app/WorkspaceEditor.tsx`, `web/src/app/editor.ts`, `internal/daemon/editor-extension/extension.js`.
- Editor extensions, integrated terminals, search/watchers, authentication extensions and webviews indirectly inherit the new Code/Node/native dependency bytes. The product's separate shell and Pi runtime are not upgraded by this pin.

Sources: the named product paths; [upstream HTTP/proxy/CLI and workbench patch diff](https://github.com/coder/code-server/compare/v4.141.0...v4.145.2).

## 4. New capabilities — separate proposals

**Recommend considering `--disable-file-cache` separately.** New upstream support keeps workspace files out of webview Cache Storage and adds `Cache-Control: no-store` to remote workspace resources; extension resources remain cached. Open Habitat could enable it in `editorHost.args` to reduce browser persistence of private workspace contents. That needs a product decision about performance/offline trade-offs and real-workbench coverage of webviews, resource headers, reload and logout. It is not necessary for the bump and should not be silently added to it.

Turkish and Vietnamese locales become available upstream without a product API change. Supporting those languages throughout Open Habitat would be a separate translation/product effort, not something this editor pin accomplishes. Repaired `--socket-fd` offers a future socket-activation option, but replacing the current private socket lifecycle would be an architectural change without an identified need here; do not include it. Remote storage was already available at 4.141.0 and is already enabled by the daemon, so it is not a new bump feature.

Source: [tagged upstream changelog](https://github.com/coder/code-server/blob/v4.145.2/CHANGELOG.md), [file-cache implementation](https://github.com/coder/code-server/blob/v4.145.2/patches/disable-file-cache.diff), `internal/daemon/editor_linux.go`.

## 5. Decision

**safe-to-bump**: both official Linux artifacts exist, normalize successfully with the unchanged builder, preserve the existing launcher contract, and bring security fixes without an identified required product change or new licence restriction. Raise the editor lock only, retain the entire upstream licence closure, and require the focused packaging and native/editor checks above before calling the release qualified. No new capability or security policy change is included in this recommendation.
