Verdict: needs-work

# MSAL Node 7.2.3 runtime assessment

Assessed 2026-11-23 against repository commit `3d6f13f67`. Do not automatically raise this pin: a normal lock regeneration introduces a second MSAL class identity, and the existing synthetic Microsoft verification test then misclassifies a refused grant as an outage. This is a product adaptation requirement, not an upstream installation failure.

## 1. Installability and upstream changes

### Runtime and breaking changes

Both 5.6.0 and 7.2.3 declare Node `>=20`; the actual packaged Node is **22.21.1** in both `runtime/core/artifact-lock.json` and `runtime/profiles/integrations/artifact-lock.json`. The development-test Node named in `TESTING.md` is not the runtime pin. The candidate installs with scripts disabled. [S1, R1]

The upstream Node changelog and installed-distribution diff show:

- v6 changes interactive loopback authentication to `form_post` by default and removes `loopbackClient` / `ILoopbackClient`.
- v7 removes the interactive `responseMode` option (the runtime rejects non-`form_post` values), and coalesces matching concurrent silent requests.
- Subsequent releases bind loopback replies to generated per-request state, sanitize authorization-code payloads, and reject unsupported confidential-client instance-aware inputs.
- 7.2.3 itself changes the common dependency to 16.17.0. [S2, S4]

Common moves from 16.13.0 to 16.17.0. Its changes include removal of legacy authority/environment metadata (the distribution diff removes DSTS recognition), stricter bidirectional authorization-code nonce validation, authority/region input validation, forwarding `resource` in refresh requests, case-insensitive response headers, ID-token cleanup fixes, and less sensitive logging. Added functionality includes tenant-region subscope claims, DPoP-related contracts, and asymmetric EAR request metadata. [S3, S4]

The product adapter uses a fixed `login.microsoftonline.com/<tenant UUID>` authority, refresh-token import and silent acquisition, not the changed interactive or confidential-client APIs. The upstream MCP package also has interactive/device-code methods, but an ordinary bump leaves those on its own compatible 5.x dependency. Do not mistake raising the root pin for upgrading all Microsoft authentication in the archive. [R2, S5]

### Dependency split: reproduced blocker

`@softeria/ms-365-mcp-server@0.170.1` requires MSAL `^5.2.2`. The current root 5.6.0 satisfies that requirement. Changing only the root pin to 7.2.3 with npm 10.9.8 produces exactly these non-root package changes:

| Package location | Before | After |
| --- | --- | --- |
| `node_modules/@azure/msal-node` | 5.6.0 | 7.2.3 |
| `node_modules/@azure/msal-common` | 16.13.0 | 16.17.0 |
| `node_modules/@softeria/ms-365-mcp-server/node_modules/@azure/msal-node` | absent | 5.6.0 |
| `node_modules/@softeria/ms-365-mcp-server/node_modules/@azure/msal-common` | absent | 16.13.0 |

The existing Azure Identity nested MSAL 6.0.1 and browser/common packages remain unchanged. No unrelated package version moved in this experiment. [R1, S5; local lock experiment]

`microsoft-native.mjs` imports `AuthError` from root MSAL but constructs the tool's `AuthManager`, which resolves nested MSAL. Its `classify()` starts with `error instanceof AuthError`. An error from the tool's separate common package fails that check and returns `unreachable`, before checking refusal or outside-tenant codes. This is a concrete user-visible health/reconnect regression. [R2]

**Reproduction:** copy the integrations manifest, lock and four fixture/adapter modules to a disposable directory; run `npm install --package-lock-only --ignore-scripts --save-exact @azure/msal-node@7.2.3`, then `npm ci --ignore-scripts`, then `node microsoft-native.test.mjs`. On native linux-arm64 with the SHA-256-verified pinned Node 22.21.1:

- Original lock: all three fixture PASS messages, including reconnect rotation and verification states.
- Candidate lock: import/reload/rotation passes, then line 81 fails: “discovery must not mask a refused tool acquisition”; actual `unreachable`, expected `refused`.
- The candidate reproduces the same failure on Node 22.23.2.

These tests use only synthetic Entra/Graph responses and disposable encrypted stores. They do not establish live provider behavior or full archive acceptance. [R2; executed comparison]

### Licence and supply chain

Registry metadata reports MIT for both Node versions and both common versions; the installed LICENSE bytes compare identical for each old/new pair. Common has no runtime dependencies. Node retains only `jsonwebtoken ^9.0.0` plus exact common; there are no declared bundled or optional dependencies in these MSAL packages. The retained JWT dependency graph does not change in the lock experiment. No new licence family enters through this bump. Existing profile dependencies and their licences still require the normal complete inventory. [S1, S4, S6; local lock comparison]

The repository URL and maintainer list match between the two version records. Neither version record supplies `gitHead`. The candidate is not deprecated, is the registry `latest` on the assessment date, and was published **2026-11-18 22:09:58.985 UTC**, about 4 days 14 hours before inspection. It is young, but not superseded or yanked according to the inspected metadata. [S1]

Both MSAL packages expose registry signatures; `npm audit signatures` on the candidate installation succeeded: **213 packages with verified registry signatures, 21 with verified attestations**. Neither MSAL Node version nor either inspected common version advertises `dist.attestations`; the 21 verified attestations elsewhere in the graph are **not** MSAL provenance. Tarball SHA-512 integrity was separately checked for both old/new Node and common tarballs. Registry signatures authenticate registry publication, not an upstream build/source attestation. [S1, S6; executed npm verification]

MSAL's manifests contain development build/test and `prepack` scripts, but no `preinstall`, `install` or `postinstall` hooks. The product builder already uses `npm ci --ignore-scripts`. No new install-time download or native addon is introduced by the changed MSAL packages. [S1, S4, R3]

### Both archive targets and size

MSAL Node/common are architecture-neutral JavaScript; their inspected packages contain no `.node` addons and declare no OS/CPU-specific selection. Existing native dependencies elsewhere in the profile are unchanged. Both linux-amd64 and linux-arm64 therefore receive the same changed npm bytes; only the existing target-specific Node/tools remain per-target downloads. Both archives still require native-target builds and verification. [S1, S4, S6, R1, R3]

Measured integrity-checked npm tarballs (bytes):

| Package | Compressed | Registry unpacked |
| --- | ---: | ---: |
| Node 5.6.0 | 460,549 | 2,471,026 |
| Node 7.2.3 | 483,397 | 2,573,880 |
| Common 16.13.0 | 471,228 | 2,883,060 |
| Common 16.17.0 | 495,470 | 3,021,526 |

Because the old pair remains nested, the normal candidate resolution adds the entire new pair: **978,867 compressed download bytes and 5,595,406 unpacked package bytes**, not just the version-size difference. These are package totals, not a predicted sealed archive delta: archive filtering, recompression and component metadata affect the latter. No complete candidate archive was built on either target. The native fixture was run on arm64 only. [S1, S6; measured tarballs and lock experiment]

## 2. What a bump must change and prove

First fix or deliberately avoid the split-class problem. Prefer a compatible MCP dependency upgrade that permits one MSAL generation if upstream offers and qualifies one; otherwise adapt the adapter to classify errors from the actual tool dependency without weakening its code-based refusal policy. Do not force an unsupported major through npm overrides and call it a mechanical bump. Evaluate cache interoperability and both tool and adapter paths explicitly. [R1, R2, S5]

Once that work is chosen:

- Raise `runtime/profiles/integrations/package.json`, regenerate its `package-lock.json` with scripts disabled, and review the complete resolution/integrity/licence diff.
- Update the exact 5.6.0 assertion in `scripts/test-integrations-runtime.py`. No MSAL version constant was found in `internal/host`; the release closure verifier checks the packaged native npm lock/component correspondence instead.
- No MSAL tarball SHA-256 is carried in `artifact-lock.json`: npm's SHA-512 integrity owns these bytes. Do **not** churn the unrelated Node/tool SHA-256 pins, Rust Cargo/crate records, Go notices, core npm lock or `runtime/core/browser-lock.json` for this change.
- Rebuild integrations for both targets. Regenerate archive/component/file digests, retained package licences/notices, `artifact.json`, and the release manifest/archive SHA-256s. Do not reuse an old integrations archive under the new lock.
- There is no carried MSAL source patch. Preserve and verify `ms-365-mcp-server-scopes.json`: `patch_ms365_scopes()` applies an exact package-version/metadata patch to the MCP server. A simultaneous MCP upgrade must re-evaluate that patch, not merely change its version guard. [R1, R3, R4]

Focused evidence after adaptation:

1. Run `microsoft-native.test.mjs` with the final dependency graph and pinned interpreter: imports, encrypted reload, rotation, refused/outside-tenant/outage distinctions, narrower tool grants and reconnect must all pass.
2. Run `python3 scripts/test-profile-runtime-build.py`; build each native target using `scripts/build-profile-runtime.sh --target linux-amd64|linux-arm64 integrations NEW_ABSOLUTE_OUTPUT_DIRECTORY` (one target per invocation), then `python3 scripts/test-integrations-runtime.py OUTPUT CORE_RUNTIME` on that target.
3. Run the daemon integrations Microsoft tests, including `TestMicrosoftSingleGrantNativeRuntime` with `OH_TEST_MICROSOFT_RUNTIME` and `OH_TEST_RCLONE` pointing at prepared sealed fixtures. A skipped opt-in test is not native evidence.
4. Run host release-closure tests and the manifest writer/verifier over the actual core plus rebuilt integrations archives. Follow `TESTING.md` for the integrated release gate; synthetic tests are not live sign-in or distinct-UID qualification. [R2–R4]

Research validation performed: baseline/candidate installation and native synthetic comparison above, registry signature audit, tarball integrity/licence comparison. `python3 scripts/validate-project-view.py` passed (13 pages), and `git diff --check` passed. No production pin, lock, source patch or generated record was changed.

## 3. Product features touched

- `runtime/profiles/integrations/microsoft-native.mjs` and `microsoft-native-cli.mjs`: native Microsoft grant import, encrypted tool-store reload and account/grant verification.
- `internal/daemon/integrations/microsoft_linux.go`: Microsoft connection setup, publication, health checks and reconnect; its native verifier consumes the states affected by this regression.
- `internal/daemon/integrations/microsoft_tenant_linux.go`: tenant acceptance and grant alignment, including outside-tenant versus transient-failure handling.
- The pinned MCP server's `dist/auth.js`: delegated Graph authentication for Outlook/mail, calendar and contacts and configured Microsoft tool scopes. Microsoft file integration also shares the product's grant/setup flow, but rclone's own authentication implementation is not replaced by this npm bump. [R2, S5]

## 4. New capabilities: proposals only

- **Concurrent silent-request sharing:** upstream coalescing can reduce duplicate refreshes for matching requests on one application instance. To benefit the long-lived MCP tool, first move that tool to a compatible MSAL version and test concurrent refresh/rotation. Separate adapter processes do not share its in-memory coalescer. [S2, S4]
- **Tenant-region metadata:** potentially expose the new optional claim only if there is a product use for it; that requires an explicit data/contract/UI choice and privacy review, not a pin-only change. [S2, S3]
- **DPoP/EAR exploration:** the common-library additions are not evidence that current Node storage and Graph workflows support an end-to-end product feature. A separate research task would need provider support, key ownership/persistence, proof generation and transport, cache handling and compatibility with the tool and rclone. Do not advertise token binding or encrypted responses from this bump alone. [S3, S4]

## 5. Recommendation

Keep this issue at **needs-work** and do not schedule an automatic mechanical bump. Adapt the dependency/error-class boundary and rerun the existing distinguishing fixture before qualifying archives. There is no observed licence, registry-signature or yanking reason for `hold`; the decisive blocker is a reproduced integration regression. No additional issue is needed to restate the blocker already documented here.

## Sources

Upstream sources inspected on 2026-11-23 (registry metadata and published tarballs are the version evidence; mutable `dev` changelogs provide release context):

- S1: npm registry Node metadata: `https://registry.npmjs.org/@azure%2fmsal-node` (versions 5.6.0 and 7.2.3, dist-tags and publication timestamps).
- S2: upstream Node changelog: `https://raw.githubusercontent.com/AzureAD/microsoft-authentication-library-for-js/dev/lib/msal-node/CHANGELOG.md` (5.6.0 through 7.2.3).
- S3: upstream common changelog: `https://raw.githubusercontent.com/AzureAD/microsoft-authentication-library-for-js/dev/lib/msal-common/CHANGELOG.md` (16.13.0 through 16.17.0).
- S4: integrity-checked published distributions from `https://registry.npmjs.org/@azure/msal-node/-/msal-node-5.6.0.tgz`, `https://registry.npmjs.org/@azure/msal-node/-/msal-node-7.2.3.tgz`, `https://registry.npmjs.org/@azure/msal-common/-/msal-common-16.13.0.tgz` and `https://registry.npmjs.org/@azure/msal-common/-/msal-common-16.17.0.tgz`. Compared manifests, LICENSE, and relevant `dist/client/ClientApplication.mjs`, `PublicClientApplication.mjs`, `dist/cache/NodeStorage.mjs`, common `dist/authority/Authority.mjs` and `dist/response/ResponseHandler.mjs` implementations.
- S5: published MCP server 0.170.1 manifest and `dist/auth.js`, installed from the checked-in lock: `https://registry.npmjs.org/@softeria/ms-365-mcp-server/-/ms-365-mcp-server-0.170.1.tgz`.
- S6: common registry metadata: `https://registry.npmjs.org/@azure%2fmsal-common`; npm registry verification keys: `https://registry.npmjs.org/-/npm/v1/keys`.

Repository sources at the assessed commit:

- R1: `runtime/profiles/integrations/{package.json,package-lock.json,artifact-lock.json}` and `runtime/core/artifact-lock.json`.
- R2: `runtime/profiles/integrations/{microsoft-native.mjs,microsoft-native-cli.mjs,microsoft-native.test.mjs,synthetic-entra.mjs}`; `internal/daemon/integrations/{microsoft_linux.go,microsoft_tenant_linux.go,microsoft_native_linux_test.go,microsoft_reconnect_linux_test.go}`.
- R3: `scripts/{build-profile-runtime.sh,integrations-runtime-build.py,test-integrations-runtime.py,test-profile-runtime-build.py}` and `runtime/profiles/integrations/ms-365-mcp-server-scopes.json`.
- R4: `internal/host/release_closure_linux.go`, `TESTING.md`, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, and “Build and verify runtime archives” in `docs/operations.md`.
