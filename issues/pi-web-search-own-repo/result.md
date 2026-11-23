# Web search extracted and released

## Outcome

`Open-Habitat/pi-web-search` is a public MIT repository. Its immutable
`v0.1.0` release points to commit `44982dc` and carries
`open-habitat-pi-web-search-0.1.0.tgz` (SHA-256
`10a8ce5f1682b7dc28db9a4b13e66a39da523723e3bbb386fcdf5cff1416d2d5`).
The conductor explicitly authorized this worker to create and publish that
repository on 2026-11-23. No product-repository push or deployment was made.

The extension, all eight device/unit tests and their turn-mode fixture moved
there. The executable extension code is unchanged; only two comments referring
to product-local implementation details changed. The ttttmr and Nico Bailon
attributions remain. README covers plain Pi, supported providers, limitations,
data destinations and the optional companion API. The package has a Pi manifest,
`pi-package` keyword, versioned changelog, no runtime dependencies and no install
scripts. Only extension, manifest, README, changelog and LICENSE ship in the npm
tarball; development tests and their pinned Pi stay in the git repository.

The product now installs the release tarball through its existing core npm lock,
including SHA-512 integrity and MIT metadata. The builder preserves the existing
`runtime/web-search/extension.mjs` loader path, copied from the installed package
and owned by `npm:node_modules/@open-habitat/pi-web-search`. The upstream LICENSE
and original npm package files participate in the same closure. No daemon or
launcher behavior, session contract, authority or turn-mode rule changes.

**The next product release must rebuild its core archives for both targets.**
This is a runtime input change, not a product-only release eligible to reuse the
old core. A native linux-amd64 core was built and verified here; linux-arm64 and
installed/live-provider acceptance remain release-qualification work.

## Checks and review

Against product base `41c214dcb` plus this extraction's final code diff, and
upstream `44982dc`:

- Upstream `npm test`: all eight pass, none skipped.
- `PI_WEB_SEARCH_TEST_PACKAGE=git:github.com/Open-Habitat/pi-web-search@v0.1.0
  npm test`: all eight pass. The native pinned Pi installs the public tag into
  disposable homes and discovers it from the package manifest, without an
  explicit extension path or an Open Habitat installation.
- The same eight tests pass with paths retargeted to the built core's Node,
  Pi and stable extension entry point. These exercise synthetic OpenAI and
  Anthropic responses, sources/history replay, refusal recovery, restricted
  turns and own-tool precedence; Codex tool selection is covered as a unit case.
- `./scripts/build-core-runtime.sh <scratch>/core`: passed, 22,315 files,
  229 components, 40 Ubuntu requirements. Archive SHA-256:
  `d7a68de2957621a6b1ecf5760a8eb3a0368dda7841dcbb77a9576c070c081b06`.
- `OH_CORE_ARTIFACT_DIR=<scratch>/core ./scripts/test-focused.sh --area go
  --go-package ./internal/host`: passed, including independent archive, npm-lock,
  licence, digest and mode verification, plus the newly exercised built-core
  target qualification. Negative cases reject a missing search entry, wrong
  component owner and wrong package version.
- A disposable npm lock containing the real release URL but a wrong SHA-512
  digest fails `npm ci --ignore-scripts` with `EINTEGRITY`.
- `python3 scripts/test-profile-runtime-build.py`: all 16 pass.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: passed.

Focused self-review is proportionate: this is an unchanged-code extraction
and dependency-pin change, not a session, browser contract, daemon-state or
authorization change. Reviewed the product diff, upstream source diff, public
file list, tarball contents, dependency metadata and public repository/release
settings. No installation identifiers or private material were included.

The verification-source tripwire initially failed as expected. Its golden was
refreshed after reviewing the changed helpers: `RequireCoreRuntime` changes the
**target qualification and manifest writer**, not `runtime-release verify`'s
archive acceptance. The verification contract remains `runtime-release-v1`;
manifest generation is expressly outside that identifier's contract.

There is no web-search Playwright spec; the existing native device suite moved
upstream and was run both there and against the built payload. No whole browser
suite or clean gate was run. Live provider credentials, a live browser
conversation, Codex subscription transport and a native arm64 build were not
exercised; synthetic tests do not establish those claims. No test-server UI
change was deployed.

Small build/test evidence is retained outside git at
`/var/tmp/agent-keep/pi-web-search-own-repo/`. The disposable core archive and
payload are not published product artifacts.

## Pattern for the next extractions

1. Preserve behavior and attribution while moving source and tests into a
   dedicated public repository. Keep optional companion safeguards even when
   ordinary Pi needs no companion. Check every file before publication.
2. Give the package its own version, MIT LICENSE, README, Pi-format changelog,
   `pi-package` keyword and explicit `pi.extensions`. Keep test-only Pi in
   devDependencies and ship only the runtime files and notices through `files`.
3. Test direct loading and native Pi git-package installation/discovery in an
   isolated home. Publish a matching tag and `npm pack --ignore-scripts` asset:
   enable immutable releases, upload to a draft, then publish the complete draft.
   Do not mutate a published release; corrections need another version.
4. Put the versioned release-asset URL in the product's existing npm dependencies
   and regenerate the lock with `npm install --package-lock-only --ignore-scripts
   --no-audit --no-fund`. Review the resolved URL, integrity, version, licence and
   any dependency changes. No second lock format or registry is needed.
5. Let the existing core builder inventory npm files and upstream licences.
   Attribute any stable loader entry point to the npm component, not the product
   launcher. Web search is a self-contained module and can be copied directly;
   an extension with relative imports needs its package layout preserved or its
   loader pointed at the installed entry point. Qualify the pinned version and
   ownership in the target-closure checks and test rejection of incorrect ones.
6. Remove product-local source/tests only once the upstream tests run. Build the
   core, independently verify its closure, and exercise the shipped entry point.
   Record test limits and rebuild both core architectures in the next release.

## Decisions for later review

- **Distribution:** Git tag for Pi users, immutable npm-pack asset for the core.
  An npm-registry publication or a bespoke git-artifact lock was unnecessary:
  the asset works with the existing digest and closure machinery.
- **Initial version:** `0.1.0`, rather than inheriting the product's version;
  the standalone package now has its own change history.
- **Loader path:** retain the established runtime path and copy the locked
  module there. Pointing both loaders into node_modules would also work, but
  would change daemon/launcher code without changing behavior. Both copies are
  in the same authenticated npm component.
- **Optional companion integration:** retain the existing symbol API. Removing
  it to claim complete host independence would bypass restricted-turn rules;
  plain Pi already works without it.
