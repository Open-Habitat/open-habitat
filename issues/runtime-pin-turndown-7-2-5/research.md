Verdict: needs-work

# Turndown 7.2.0 → 7.2.5

Research date: 2026-11-23. Repository baseline: `84fe94987`.

**Recommendation:** coordinate the update with a new `@open-habitat/pi-page-reader` release. Turndown itself looks compatible, but changing only the core root pin does not update the product's actual consumer: page-reader 0.1.0 pins Turndown **exactly to 7.2.0**. A scratch lock regeneration confirmed npm retains 7.2.0 nested below page-reader and adds 7.2.5 at the root. This is not an effective mechanical product upgrade. No pins or locks were changed in this research. [R1, R2, U4]

## 1. Installability and upstream changes

### Compatibility

There is no removed public API or changed entry-point layout in the reviewed source/package diff. CJS, ES and browser UMD files remain available, including the browser UMD file the reader loads. There are observable Markdown corrections, not a new product protocol: [U1–U3]

- **7.2.1:** ordered-list continuation indentation follows the marker width, including multi-digit numbers; sibling-item separation changes too.
- **7.2.2:** newline trimming avoids regex bottlenecks.
- **7.2.3:** link destinations containing spaces are enclosed in angle brackets; link/image destinations, image alt text and titles receive additional Markdown escaping. Build tooling moves to newer Rollup/Babel, with declared Node `>=18` and npm `>=9` requirements.
- **7.2.4:** reverts the PRE linebreak normalization introduced in 7.2.3. Do not describe that reverted behavior as a candidate feature.
- **7.2.5:** replaces repeated output-string concatenation with an array accumulator; adds an upstream performance benchmark and updates development dependencies. Rule replacement callbacks still receive strings and `turndown()` still returns a string. No measured Open Habitat speedup is claimed.

The actual runtime pin is **Node 22.21.1**, not the development-test Node version in `TESTING.md`. Its bundled npm is **10.9.4**; both satisfy the new requirements. The browser build is shipped precompiled, so upstream Rollup's development/native dependencies are not new runtime dependencies. [R3, U3, U5]

### Licence and supply chain

- Both tarballs declare **MIT**, and their LICENSE files have identical SHA-256 `a055e3a15db4b4cbb5af381230eba085603126d7d5d8c4dae45ee85b877a9729`. The sole runtime dependency remains `@mixmark-io/domino: ^2.2.0`; the product locks 2.2.0, which declares **BSD-2-Clause**, has no runtime dependencies and supplies its own licence. No bundled dependency tree or native binary was found in the Turndown tarballs. Retain both packages' notices. [U1, U3, U6, R1]
- Registry repository identity and the two-entry maintainer list are unchanged between the two version records. This is an observation of current metadata, not proof that account ownership never changed. Candidate `gitHead` is `b86e2b18539fa4922acf7001902255e2ce5bf0b9`. [U1]
- Registry `latest` is **7.2.5**; it is not marked deprecated. Publication is **2026-11-04 11:58:37 UTC**, approximately 19 days before this report, not a future release. Intermediate releases are 7.2.1 on 2025-08-14, 7.2.2 on 2025-10-24, and 7.2.3/7.2.4 on 2026-04-03. No newer release was listed. [U1]
- Both downloaded tarballs matched registry SHA-512 integrity. Both candidate registry signatures verified with npm's published key `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`; the old version's signature also verified. Verification used Node `crypto.verify` over `name@version:dist.integrity`. These are registry signatures, **not build provenance**. Neither version record advertises `dist.attestations`; no provenance attestation was available to verify. [U1, U7]
- Neither version declares `preinstall`, `install` or `postinstall`. Both have a source `prepare` build script; the candidate additionally has a benchmark script. The product installs registry packages with `npm ci --ignore-scripts`, so it does not run these builds. No unexpected production dependencies appeared. This inspection does not certify the entire runtime dependency graph free of vulnerabilities. [U1, U3, R4]

### Both archive targets

Turndown and Domino are JavaScript, with no CPU/OS selection, native addon or per-target binary download. The same npm tarballs serve `linux-amd64` and `linux-arm64`. Measured Turndown compressed size changes **19,089 → 18,926 bytes**; registry unpacked size changes **191,565 → 193,256 bytes**, ten files in each version. That is +1,691 unpacked bytes for a real replacement, not a prediction of final core archive size. A root-only bump instead retains the old copy and adds the new one, about 193 KB additional unpacked package content. Core archives still require separate native builds because other runtime components are architecture-specific. [U1, U3, R4, R5]

## 2. What the product must account for

### Resolve the consumer pin first

`runtime/core/package-lock.json` records page-reader 0.1.0's exact dependency. Its upstream `extension.mjs` uses package-local `createRequire` resolution to read `turndown/lib/turndown.browser.umd.js`. npm therefore correctly keeps that consumer on 7.2.0 after a root-only bump. [R1, U4]

Scratch reproduction: copy the real core manifest and lock, change only root `dependencies.turndown` to `7.2.5`, then run `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`. Under Node 22.23.2/npm 10.9.8, only the root lock record, root Turndown entry, and a new `node_modules/@open-habitat/pi-page-reader/node_modules/turndown` entry changed; the nested entry is **7.2.0**. The run completed with an unrelated existing Pi peer-dependency warning, not a Turndown failure.

Prefer releasing page-reader with the updated dependency and its extraction tests, then raising both product pins. A product npm override could force the dependency instead, but would be a deliberate override of the upstream exact dependency, not something to slip into an automatic bump. No override or new upstream release was made here.

### Inputs and generated records

- Update `runtime/core/package.json` and regenerate `runtime/core/package-lock.json` using `--package-lock-only --ignore-scripts`, preserving unrelated locked versions. For the coordinated route, include page-reader's new release URL, integrity and version. Verify the **consumer-resolved** Turndown version, not only the root entry. [R1, R2, R6]
- Update the Turndown required-version map in `internal/host/release_closure_linux.go` and corresponding fixture in `internal/host/release_closure_linux_test.go`; update page-reader there too when its version moves. The current verifier accepts a matching npm component anywhere in the closure, so merely adding root 7.2.5 can pass its version check while the reader still resolves 7.2.0. A consumer-resolution assertion is necessary evidence. `CoreAgentTools` and `HeadlessShell` constants do not change. [R7]
- **No Turndown input SHA-256 exists in `runtime/core/artifact-lock.json`.** Its npm integrity belongs in the npm lock. Leave Node/tool artifact SHA-256s, Rust Cargo.lock/crate licence records, Ubuntu requirements, `runtime/core/browser-lock.json`, optional browser-profile locks and `web/package-lock.json` unchanged for this update. [R1, R3, R4]
- Rebuild each core archive; `scripts/core-runtime-build.py` regenerates packaged manifests, npm component versions, file/component SHA-256s, retained licence inventory and output `artifact.json` with archive digest/sizes. Generate a fresh release manifest/digest from those artifacts. Do not reuse a previous core archive after changing its inputs. There is no separately curated Turndown notice to edit. [R4, R5]
- There is **no carried Turndown source patch**. Keep the unrelated exact-match `runtime/core/bridge-patch.json` applied through `patch_bridge`; it should not need modification. Keep the page-reader loader's locked-browser and sandbox configuration. [R4, R6]

### Focused checks for the implementation

1. In the upstream page-reader change, run its tests against the candidate and exercise its browser UMD extraction with synthetic multi-digit/nested lists, code blocks, links containing spaces/parentheses, escaped image alt/title text, and visible-text fallback. Confirm unchanged result shape and bounds. Do not accept only a CJS smoke test as browser qualification. [U4, R6]
2. Regenerate the core lock without scripts, review the complete diff and assert resolution from the installed page-reader package reaches **7.2.5**. Preserve its own dependency layout. [R1, R6]
3. Run `go test ./internal/host -run 'TestReleaseClosure'` with the documented test prerequisites and `python3 scripts/test-profile-runtime-build.py`. These prove version/closure rules and target-lock consistency, not extraction behavior. [R5, R7]
4. Build `scripts/build-core-runtime.sh --target linux-amd64 NEW_OUTPUT` and the equivalent arm64 build on matching native builders; run `OH_CORE_ARTIFACT_DIR=OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore` for each. Exercise the built loader as well as plain-Pi discovery. Verify the new release manifest/closure as described in `docs/operations.md`. These are required implementation evidence, **not tests performed by this research**. [R5, R6]

## 3. Features and code paths

The affected feature is the agent's **`read_page` HTML-to-Markdown extraction**, not the web client's Markdown rendering. `runtime/core/agent-bin/pi` loads `runtime/page-reader/extension.mjs`; `runtime/core/page-reader-loader.mjs` registers the upstream reader with the locked browser. `internal/daemon/recap_linux.go` also supplies that extension to recap sessions. The upstream `registerPageReader` loads the browser UMD source; `extractor` runs Readability then Turndown inside the page, using ATX headings, fenced code and `-` bullets, removing script/style/noscript/iframe elements and falling back to visible text when extraction is too short. [R6, R8, U4]

Consequently the meaningful changes are more faithful lists/link/image Markdown and potentially cheaper concatenation on long pages. Browser navigation, proxy/SSRF controls, sandbox enforcement, screenshots, and the separately collected links do not gain new APIs from this update. [U2, U4]

## 4. New capabilities and proposals

No new public conversion API, format or end-user feature was introduced. Correct escaping, indentation and performance improvements become automatic benefits **once the reader actually resolves the candidate**. [U2, U3]

Conductor proposal, separate from the bump: add a long-article extraction benchmark to page-reader using the same HTML with both versions, recording output equality where expected and conversion time/memory. Only measurements could justify changing read limits or budgets; do not raise them as part of this update. Existing customization/plugin APIs are not new in 7.2.5.

## 5. Evidence and verdict limits

Performed: upstream release/source and published-package inspection; SHA-512 integrity and registry-signature verification; identical licence comparison; scratch lock-only resolution experiment; four CJS smoke comparisons (ordinary strong text unchanged, multi-digit list indentation corrected, spaced link enclosed, image attributes escaped). The smoke checks used Node 22.23.2 with Domino 2.2.0, not a native archive or Chromium. No native amd64/arm64 build, upstream full suite or browser device suite ran. Documentation validation and `git diff --check` passed before commit.

**Needs-work is about delivering the update to the real consumer**, not an identified Turndown regression or licence rejection. Update and test page-reader first (or explicitly choose an override), then reassess the coordinated pins. No product wire-contract migration was identified.

## Sources

Upstream sources were fetched directly with bounded HTTP requests; registry metadata is a point-in-time observation.

- U1: npm registry metadata, `https://registry.npmjs.org/turndown` (versions, timestamps, tags, signatures, dependencies and engines).
- U2: upstream release notes, `https://api.github.com/repos/mixmark-io/turndown/releases`; source diff, `https://github.com/mixmark-io/turndown/compare/v7.2.0...v7.2.5` (especially `src/commonmark-rules.js`, `src/turndown.js`, `src/utilities.js`). No CHANGELOG file was available at the candidate tag; release notes supply the history.
- U3: published packages, `https://registry.npmjs.org/turndown/-/turndown-7.2.0.tgz` and `https://registry.npmjs.org/turndown/-/turndown-7.2.5.tgz` (manifests, built code, licences and measured sizes).
- U4: pinned consumer source, `https://raw.githubusercontent.com/Open-Habitat/pi-page-reader/v0.1.0/extension.mjs` and `https://raw.githubusercontent.com/Open-Habitat/pi-page-reader/v0.1.0/package.json`.
- U5: bundled npm version, `https://raw.githubusercontent.com/nodejs/node/v22.21.1/deps/npm/package.json`.
- U6: Domino metadata, `https://registry.npmjs.org/@mixmark-io/domino/2.2.0`; package, `https://registry.npmjs.org/@mixmark-io/domino/-/domino-2.2.0.tgz`.
- U7: npm signing keys, `https://registry.npmjs.org/-/npm/v1/keys`.
- R1: `runtime/core/package-lock.json` (root, page-reader, Domino and Turndown entries).
- R2: `runtime/core/package.json`.
- R3: `runtime/core/artifact-lock.json`, `node.version` and both target pins.
- R4: `scripts/build-core-runtime.sh`; `scripts/core-runtime-build.py`.
- R5: `TESTING.md`; `docs/operations.md`, “Build and verify runtime archives”.
- R6: `runtime/core/AGENTS.md`; `runtime/core/page-reader-loader.mjs`; `runtime/core/bridge-patch.json`.
- R7: `internal/host/release_closure_linux.go`, `validCoreRuntime`; `internal/host/release_closure_linux_test.go`.
- R8: `runtime/core/agent-bin/pi`; `internal/daemon/recap_linux.go`.
