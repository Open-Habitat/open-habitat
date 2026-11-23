# Page reader extracted and released

## Outcome

`Open-Habitat/pi-page-reader` is a public MIT repository. Its immutable
`v0.1.0` release points to commit `024b6f28118909ebaa1c6822709fa924c3ae0e3a`
and carries `open-habitat-pi-page-reader-0.1.0.tgz` (SHA-256
`08a675fb41f2ff707fe790ddf8c0615eee3ddd7142ff14835cadf0aa64efd810`).
The conductor authorized creating and publishing this repository. No product
repository push or deployment was made.

The extension, all 20 existing page-reader tests and their synthetic quotes
fixture moved upstream. Two additional configuration tests cover mandatory
sandbox launch arguments, generic/host-supplied refusal guidance, explicit
executable validation, and a host's pinned directory taking precedence without
fallback. The README describes installation, Linux requirements, data
destinations, limits and the existing local-target exception. Nico Bailon's
pi-web-access attribution is retained. The npm asset contains only the
extension, manifest, README, changelog and LICENSE; test-only Pi stays in the
git repository's devDependencies.

Plain Pi uses `PI_PAGE_READER_EXECUTABLE_PATH` when supplied, otherwise the
pinned Playwright's default headless-shell cache. The product keeps its existing
`runtime/page-reader/extension.mjs` entry point as a small first-party adapter.
It imports the installed npm package, supplies the runtime's locked browser
directory, and appends the product's AppArmor advice. The package contains no
product-specific refusal wording or runtime-layout assumption. The reader's
sandbox, proxy, address checks, contexts, extraction and tool contract are
unchanged. No daemon, session, authorization or browser UI changes were needed.

The core npm lock pins the release URL, SHA-512 integrity, version and MIT
licence. The implementation and LICENSE belong to the npm component; the
adapter belongs to `agent-launcher`. Closure qualification now requires the
package version and implementation ownership as well as the existing loader.
The browser and QA Playwright pins remain unchanged (revision 1208,
Playwright 1.58.0). Unused page-reader-only dependencies were removed from the
product's device-test package.

**This changes runtime inputs: rebuild core archives for both architectures
in the next product release. Do not reuse the previous core.** A native
linux-amd64 core was built and independently verified here. A linux-arm64
build and installed/live-browser acceptance remain release-qualification work.

## Checks and review

Against product base `0d474b3f6` plus this extraction's final code diff, and
upstream `024b6f2`:

- Upstream `npm test`: all 22 tests pass, none skipped. The native Pi case
  required successful sandboxed rendering with
  `PI_PAGE_READER_REQUIRE_SANDBOX=1`, not merely a sandbox-refusal result.
- `PI_PAGE_READER_TEST_PACKAGE=git:github.com/Open-Habitat/pi-page-reader@v0.1.0
  npm test`: all 22 pass with sandbox required, both with the default
  Playwright cache selection and with an explicit executable. Pi installs the
  public tag into disposable homes and discovers the extension from its package
  manifest, without a product launcher or explicit extension argument. The
  synthetic model receives the JavaScript-rendered article.
- `./scripts/build-core-runtime.sh <scratch>/core`: passed, 22,320 files,
  230 components, 40 Ubuntu requirements. Core archive SHA-256:
  `12dd259432fefc8ba18144f51f20b6ea084f68134f2dd44d97d32a6e372a9635`.
- All 20 moved device tests pass with the built core's Node, Pi, installed
  page-reader module and stable product adapter. A networkless rootless
  container run additionally requires successful sandboxed rendering through
  that adapter and the built Chromium. It uses a nonroot UID, drops container
  capabilities, and permits namespace syscalls with container seccomp
  unconfined; Chromium's own sandbox stays enabled. This is synthetic
  single-UID runtime evidence, not installed-host or cross-UID qualification.
- The first strict sandbox run directly from build scratch was refused by
  host policy, as expected for a browser outside the installed executable
  policy. A separate native scratch run passes all 20 tests including the
  explicit refusal path; the container run above supplies the positive
  built-browser evidence. No host policy was altered.
- `OH_CORE_ARTIFACT_DIR=<scratch>/core ./scripts/test-focused.sh --area go
  --go-package ./internal/host`: passed. This includes independent archive,
  npm-lock, licence, digest, mode and target-closure verification. Negative
  cases reject missing implementation bytes, wrong ownership and wrong version.
- A disposable npm lock naming the real release URL but a wrong SHA-512
  digest fails `npm ci --ignore-scripts` with `EINTEGRITY`.
- `python3 scripts/test-profile-runtime-build.py`: all 16 pass.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`,
  `gofmt -d` on changed Go files and `git diff --check`: passed.

The verification-source tripwire initially failed and was refreshed after
review. The added checks are in target qualification (`RequireCoreRuntime`),
not archive acceptance by `runtime-release verify`. The verification contract
therefore remains `runtime-release-v1`; no covered verification semantics
changed. A transient npm download timeout during one plain-Pi install was
retried successfully. No required check remains failed or blocked.

Focused self-review is proportionate: executable changes are confined to
browser configuration and setup guidance, with unchanged sandbox and network
policy; there is no session, daemon-state, wire-contract or authorization
change. Reviewed the complete extraction diff, product adapter, dependency
locks, closure tests, public file list, README security claims, tarball contents,
and public repository/release settings. Only the five intended files ship in
the tarball; no private installation material or captured pages were published.

No whole browser suite or clean gate ran. No page-reader browser spec exists;
the native device suite verifies the same entry point used by browser
conversations. No live provider or installed browser conversation, native arm64
runtime, or test-server deployment was exercised. No test-server UI change was
made. Small logs are retained outside git at
`/var/tmp/agent-keep/pi-page-reader-own-repo/`; the disposable built core is not
a published product artifact.

## Decisions for later review

- **Linux-only support:** retain the kernel socket-owner check and declare
  Linux in the package instead of weakening it for macOS or Windows. Other
  platforms require a separate equivalent ownership mechanism.
- **Browser selection:** explicit executable environment variable, otherwise
  Playwright's default cache. This avoids a new settings store or guessing
  arbitrary system browsers. Installation of browser binaries and sandbox
  policy remains the operator's job, not an npm install script.
- **Product integration:** a small adapter passes the locked directory and
  host guidance. Copying and patching the upstream implementation would duplicate
  host assumptions; environment-only configuration would unnecessarily change
  daemon and launcher setup. The adapter never falls back from its locked
  browser to the person's standalone setting.
- **Distribution:** follow web search's git tag plus immutable npm-pack asset,
  versioned independently at `0.1.0`; no npm-registry publication or second
  dependency-lock format is needed.
