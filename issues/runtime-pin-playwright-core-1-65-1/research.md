Verdict: needs-work

# Playwright core 1.65.1 runtime assessment

Assessed 2026-11-23 against repository commit `19b49a59ac512cceed340432913033bf1c5b436f`. No runtime inputs were changed.

**Recommendation:** coordinate the page-reader dependency, Chromium and Python QA wheel updates before raising this pin. A root-only npm bump installs successfully but leaves the actual page reader on a nested **1.58.0**. Moving the shared browser independently would then pair that old driver with a much newer browser. This is not a mechanical pin-and-lock update. There is no demonstrated upstream regression or licence prohibition requiring `hold`.

## 1. Installability and upstream changes

### Package and runtime

Registry metadata identifies 1.65.1 as the current `latest` stable release, published **2026-11-13 21:36:08 UTC**, approximately ten days before assessment. `next` is 1.66.0 alpha, not a newer stable release. Neither inspected version carries a deprecation marker. The patch release fixes a TypeScript decorated-class regression and Bun test-location reporting; these are test-runner fixes, not evidence that Habitat's page-reader path has been qualified. [U1–U3]

| Property | 1.58.0 | 1.65.1 |
| --- | --- | --- |
| Node engine | `>=18` | `>=20` |
| npm licence | Apache-2.0 | Apache-2.0 |
| Declared runtime/optional dependencies | none | none |
| Package lifecycle scripts | none | none |
| Tarball bytes, downloaded | 2,208,268 | 3,232,772 |
| Registry unpacked bytes | 9,311,756 | 13,971,424 |
| Registry file count | 363 | 116 |
| Chromium headless-shell revision | 1208 | 1255 |
| Chromium version | 145.0.7632.6 | 159.0.8154.6 |

Both tarballs' SHA-512 digests were checked against registry integrity. The runtime's actual Node pin is **22.21.1**, in `runtime/core/artifact-lock.json`, not the contributor test-tool version in `TESTING.md`. It satisfies the new engine constraint and belongs to upstream's tested Node 22 major; upstream 1.65 no longer tests Node 20 despite accepting it in `engines`. No Node pin change is required by this package's declared engine. This is static compatibility evidence, not execution on the exact runtime Node. [U1, U2, U4; repository artifact lock]

### Breaking changes across the interval

The versioned release notes and downloaded package comparison show the following relevant changes. No separate breaking-change section appears for 1.61–1.63; this is not a guarantee of unchanged behavior. [U4, U5]

- **1.59:** WebKit drops macOS 14; the experimental Svelte component-test package is removed; JUnit distinguishes errors from failures. None is on the shipped Linux page-reader path.
- **1.60:** removes `Locator.ariaRef`, exposed-binding `handle`, connection `logger`, and legacy `videosPath`/`videoSize` options. The pinned reader does not use those APIs.
- **1.64:** device descriptors now forward `screen`; hidden-frame descendants count as hidden; JSX follows tsconfig; missing-snapshot update mode now passes. The reader creates its own context rather than spreading a device descriptor.
- **1.65 library changes:** actions wait for non-inert elements; cookie matching follows RFC 6265; proxy credentials answer only proxy challenges; inaccessible/unrendered text is excluded from accessible names and aria snapshots; string/URLSearchParams request parameters append rather than replace existing queries. These warrant network/rendering regressions, even though the reader does not expose cookies, form actions or APIRequestContext to agents.
- **1.65 test-runner changes:** TypeScript class-field semantics follow tsconfig; completely empty sharded runs fail; CSS-family imports must exist; blob output cleanup returns; imported CommonJS test-call source positions change. The separate `web/` test dependency is not upgraded by a runtime-core bump.

The reader uses `chromium.launch`, a fresh context with a per-read proxy, `page.goto`, load-state waits, browser-side extraction and JPEG screenshots. It supplies `executablePath` found in the product browser directory, so a stale browser lock need not fail immediately with a missing Playwright revision; it can silently produce an unsupported driver/browser pairing. [U7; `runtime/core/page-reader-loader.mjs`]

### Supply-chain evidence

- The repository remains `microsoft/playwright`; the registry maintainer set changed (one entry removed, two added). This is a signal to review, not proof of compromise. No maintainer identity is treated as independent authentication. [U1, U2]
- Registry signatures are present for both versions. Verification using Node's crypto implementation, the public npm signing key and the canonical `name@version:integrity` message succeeded for the old signature and both candidate signatures. The key identifier is unchanged: `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. [U1, U2, U6]
- Both publish and SLSA provenance attestations are available. Their subjects match the tarball SHA-512 digests. The old provenance names the tag-triggered `publish_release.yml`; the candidate names manually dispatched `publish_manual.yml` on `release-1.65`, in the same repository and owner IDs. The candidate attested commit `cb1c1d0e6bcd407d0c8b189ad828f560cb485476` differs from registry `gitHead`/release tag `bbd948344ea9a60bf1e6f125c02ca99b2b51593b`. GitHub's comparison reports the former one commit behind with **no file differences**. Thus the observed source trees agree, rather than assuming equal commit IDs. Attestation contents were inspected, but Sigstore certificate-chain/transparency verification was **not** performed. [U6, U8]
- No lifecycle scripts, declared dependency additions or native `.node`/`.so`/`.exe` files were found in the candidate tarball. It now includes `lib/webp_codec.wasm`, an architecture-neutral WebAssembly codec, and substantially reorganizes code into bundles. Absence of npm dependencies does **not** mean absence of bundled dependencies. [U1, U2; downloaded package comparison]

### Licences and bundled content

The top-level Apache licence is byte-identical. The important packaging change is that `ThirdPartyNotices.txt` now directs readers to bundle-sidecar licence files instead of containing the old consolidated inventory. The candidate includes `lib/utilsBundle.js.LICENSE`, `lib/serverRegistry.js.LICENSE` and `lib/webp_codec.LICENSE`. The npm notice sections change from 133 old entries to 80 distinct candidate entries; that count is not a security or completeness score. Newly listed package families include filesystem watchers, console formatting, platform browser helpers and `proxy-agent-negotiate`; several existing dependencies also change versions. [U1, U2; tarball notice diff]

Inspected sidecars contain MIT, ISC, BSD and Blue Oak terms; the WebP notice supplies libwebp's BSD terms and patent grant plus Emscripten's MIT/NCSA terms. No new copyleft requirement was identified in these inspected package notices. Preserve the actual texts, not a blanket Apache label for every bundled byte. Chromium's own third-party closure is separate and remains unqualified until its new archives/notices are inspected. This is an inventory assessment, not a blanket legal clearance. [U2 tarball licence files]

`core-runtime-build.py` copies package files recursively, so it retains these sidecars, but its `license_files` discovery only recognizes root filenames beginning with license/licence/copying/notice. It does not index the nested sidecars (nor root `ThirdPartyNotices.txt`). For the candidate's split-notice format, add explicit licence-record coverage and a negative fixture proving missing sidecars cannot pass qualification. Existing preservation of all files is not the same claim as complete licence indexing. [Repository: `scripts/core-runtime-build.py`, npm inventory loop]

### Both archive targets

The npm package is the same for linux-amd64 and linux-arm64: no per-target npm native build or automatic browser download is added. Its own unpacked footprint grows by **4,659,668 bytes**. A root-only bump additionally retains a complete nested old Playwright for the reader, so that is not the net archive delta. [U1, U2; dependency-resolution experiment below]

The candidate expects Chromium 159/revision 1255. Unlike the current lock's separate arm64 Playwright build and borrowed amd64 notice archive, upstream now publishes **Chrome for Testing headless-shell for both Linux architectures**. The candidate's `lib/coreBundle.js` registry maps Ubuntu 24.04 arm64 to `linux-arm64/chrome-headless-shell-linux-arm64.zip`. Official CfT metadata and successful HTTP HEAD requests agree: [U2, U9]

| Target | Candidate official headless-shell ZIP | Compressed bytes |
| --- | --- | ---: |
| linux-amd64 | `159.0.8154.6/linux64/chrome-headless-shell-linux64.zip` | 131,851,262 |
| linux-arm64 | `159.0.8154.6/linux-arm64/chrome-headless-shell-linux-arm64.zip` | 130,286,843 |

The browser ZIPs were not downloaded/extracted during this research: expanded sizes, SHA-256s, executable layout, arm64 notice membership and Ubuntu shared-library requirements need qualification before locking. Do not copy the old arm64 prefix or notice workaround automatically. If the new arm64 ZIP contains its own required notice, remove the separate notice record: `add_headless_shell` rejects simultaneously supplied embedded and fallback notices. Regenerate both native core archives on matching-architecture builders; neither compressed core size nor arm64 execution is established here. [Repository: `runtime/core/browser-lock.json`, `scripts/browser-runtime-build.py`, `scripts/build-core-runtime.sh`; U9]

## 2. Required coordinated work and focused proof

### Reproduced blocker: the consumer remains on 1.58.0

The released `@open-habitat/pi-page-reader` 0.1.0 declares **exactly** `playwright-core: 1.58.0`. Its own `extension.mjs` dynamically imports that name. A disposable two-dependency manifest containing the unchanged page-reader release and root Playwright 1.65.1, resolved with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, produced:

```text
node_modules/playwright-core                                      1.65.1
node_modules/@open-habitat/pi-page-reader/node_modules/playwright-core 1.58.0
```

This is an actual resolver result, not a hypothetical conflict. Recommend updating and qualifying the page-reader upstream dependency first, releasing it, and then taking its new digest-locked package alongside Playwright. Do not introduce an npm override or edit vendored package metadata silently. [U7; `runtime/core/package-lock.json`]

### Inputs and records

1. Update `runtime/core/package.json` and regenerate `package-lock.json` using `--package-lock-only --ignore-scripts`. Confirm the reader resolves to the intended driver, not merely that the root entry changed.
2. Regenerate `runtime/core/browser-lock.json`: version/revision, both URLs, prefixes and independently computed SHA-256s, including any still-required notice artifact. Raise `HeadlessShell` in `internal/host/release_closure_linux.go` and its fixtures.
3. Update the coordinated page-reader version and Playwright version accepted by the required npm map in that verifier and `release_closure_linux_test.go`.
4. Update **both** Python Playwright wheel records and SHA-256s in `runtime/profiles/browser/artifact-lock.json`. Inspect each wheel's `playwright/driver/package/browsers.json`; `add_browser` requires its headless-shell version and revision to equal the core lock. Resolve/review pyee, greenlet and typing-extensions from wheel metadata if their requirements changed; do not guess versions. The Python candidate wheels were not qualified in this run.
5. Extend npm licence indexing for the sidecars; rebuild generated component/file/licence records, digests, `artifact.json`, archives and release manifest. Notices must come from the new bytes. The core `artifact-lock.json` Node and Rust tool entries do **not** need new SHA-256s for a Playwright-only change; npm integrity lives in its npm lock. No Cargo/crate or Go-binary notice regeneration is implied.
6. There is no carried Playwright source patch. Keep the unrelated exact-once `bridge-patch.json` application intact. The loader's browser-directory override and sandbox policy remain product-owned. Check the installed AppArmor path against the actual new executable layout; do not relax sandboxing to make tests pass.

Sources: `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, `scripts/core-runtime-build.py`, `scripts/browser-runtime-build.py`, `internal/host/release_closure_linux.go`, `docs/operations.md` (“Build and verify runtime archives”).

### Checks for the implementation, not claimed as run here

- Run the page-reader upstream unit/device tests against the candidate dependency; exercise the **built product loader** as well as plain Pi discovery. Prove JS rendering, extraction, screenshot, cancellation/deadline behavior, logged-out context isolation and idle browser cleanup.
- Preserve network/sandbox refusal evidence: denied private-address navigation, redirect/subresource/iframe attempts, WebRTC egress policy, proxy connection ownership and missing-sandbox refusal. The upstream proxy-auth fix does not replace Habitat's egress guard.
- Run `python3 scripts/test-browser-runtime-build.py` and `python3 scripts/test-profile-runtime-build.py`, including the new arm64 layout and licence-sidecar negative fixtures.
- Run `go test ./internal/host -run 'TestReleaseClosure'`, with the repository's required test prerequisites. Add rejection coverage for stale driver/browser acceptance and incomplete licence records as appropriate.
- Build core on each native target with `scripts/build-core-runtime.sh ... --target linux-amd64|linux-arm64`; build each browser profile too. Run `OH_CORE_ARTIFACT_DIR=<output> go test ./internal/host -run TestReleaseClosureBuiltCore` and the manifest writer/verifier over the resulting complete archive set. Test actual native sandboxed page reads on both architectures; metadata and synthetic builder tests cannot prove them.

The repository's integrated clean gate and release qualification remain conductor/release work. A whole browser suite is neither necessary for this research-only commit nor a substitute for the packaged reader/browser tests. [Repository: `TESTING.md`, `docs/operations.md`]

## 3. Product features touched

- **Agent `read_page`:** `runtime/core/page-reader-loader.mjs` registers the upstream reader with the locked browser directory; the upstream `extension.mjs` owns rendering, proxying, extraction and screenshot behavior. The pin affects this feature only after the reader's exact dependency is coordinated. [U7]
- **Pi extension loading:** `runtime/core/agent-bin/pi` loads the stable page-reader entry point; `internal/daemon/recap_linux.go` adds that same runtime entry point to Pi arguments. These must continue to resolve the newly qualified package.
- **Optional browser QA environment:** `runtime/profiles/browser/artifact-lock.json` and `scripts/browser-runtime-build.py` provide the Python wheelhouse sharing the core browser. It cannot remain at 1.58 while the shared shell is moved to revision 1255.
- **Runtime distribution and acceptance:** `scripts/core-runtime-build.py`, `internal/host/release_closure_linux.go` and the release manifest verifier own version, file, licence and target checks.
- **Not directly upgraded:** the separate `web/package.json` test runner, the server-browser viewer and the vendor-installed interactive Chrome path in `internal/host/server_browser_linux.go`. A runtime npm bump is not an update to those features.

## 4. New capability proposals — outside the bump

These are optional conductor proposals, not changes authorized by this research:

1. **AbortSignal-based reader cancellation** (1.62; CDP timeout/signal in 1.65): evaluate replacing selected timeout/close workarounds upstream with cancellable operations, while retaining a hard whole-read deadline and cleanup tests. [U4]
2. **WebP screenshots** (1.62): potentially lower image transfer/storage costs. The reader currently emits JPEG; adopting WebP requires measurements, supported output MIME/schema handling and image-rendering tests. It is not obtained just by shipping the codec. [U4, U7]
3. **Open-shadow-root extraction** (`page.content({includeShadow:true})`, 1.64): investigate better reads of component-heavy pages. The present reader extracts inside the page; it would need an explicit extraction strategy and bounded-content/link tests, not just a different method flag. [U4, U7]
4. **Page-defined WebMCP tools** (1.64): possible future agent interaction with sites, but it changes the current read-only tool's authority. It needs a separate architecture decision, user approval/permission integration and egress analysis; do not expose page-defined actions through `read_page` as part of a bump. [U4; `runtime/core/AGENTS.md`]

Test-runner additions such as Bun, failure-only reporting, test locks and shuffled scheduling belong to a separate developer-tooling assessment, not runtime product functionality. [U4]

## 5. Verdict and evidence limits

**needs-work** because the shipped consumer pins the old driver, the browser/Python lock family must move together, and bundled licence records need adaptation to the new sidecar format. Recommend the coordinated page-reader/browser update above, then reassess for a mechanical landing. Do not auto-bump only the root package.

Executed: source/lock review; official registry/release/tag comparison; both npm tarball downloads and SHA-512 checks; npm registry signature verification; provenance payload and source-tree comparison; notice/package-layout diff; official browser metadata/HEAD size checks; isolated npm lock-resolution reproduction. No live installation was touched. No Chromium archives, Python wheels, native runtime builds, browser execution or full Sigstore verification were qualified. Those limitations do not weaken the demonstrated dependency-resolution blocker.

Documentation validation: `python3 scripts/validate-project-view.py` passed (13 pages); `git diff --check` passed. No issue metadata changed.

## Sources

All upstream observations were retrieved on 2026-11-23. Tarball-relative paths above identify the exact files inspected in digest-verified published packages; local paths identify repository sources at the commit stated above.

- **U1 — npm metadata, baseline:** https://registry.npmjs.org/playwright-core/1.58.0
- **U2 — npm candidate metadata and package bytes:** https://registry.npmjs.org/playwright-core/1.65.1 ; https://registry.npmjs.org/playwright-core/-/playwright-core-1.65.1.tgz ; release times/tags: https://registry.npmjs.org/playwright-core
- **U3 — official patch release:** https://github.com/microsoft/playwright/releases/tag/v1.65.1
- **U4 — versioned upstream release notes (1.59–1.65):** https://github.com/microsoft/playwright/blob/v1.65.1/docs/src/release-notes-js.md
- **U5 — upstream comparison:** https://github.com/microsoft/playwright/compare/v1.58.0...v1.65.1 (API reports 2,434 commits and caps the returned file list at 300; it was not treated as an exhaustive audit). The downloaded npm trees were additionally compared for manifest, browser, bundling and licence changes.
- **U6 — registry keys and attestations:** https://registry.npmjs.org/-/npm/v1/keys ; https://registry.npmjs.org/-/npm/v1/attestations/playwright-core@1.58.0 ; https://registry.npmjs.org/-/npm/v1/attestations/playwright-core@1.65.1
- **U7 — actual pinned page-reader source artifact:** https://github.com/Open-Habitat/pi-page-reader/releases/download/v0.1.0/open-habitat-pi-page-reader-0.1.0.tgz (`package.json`, `extension.mjs`); source repository: https://github.com/Open-Habitat/pi-page-reader
- **U8 — tag versus attested source:** https://api.github.com/repos/microsoft/playwright/compare/bbd948344ea9a60bf1e6f125c02ca99b2b51593b...cb1c1d0e6bcd407d0c8b189ad828f560cb485476
- **U9 — official browser download metadata:** https://googlechromelabs.github.io/chrome-for-testing/159.0.8154.6.json ; HEAD requests used its Linux `chrome-headless-shell` URLs.
