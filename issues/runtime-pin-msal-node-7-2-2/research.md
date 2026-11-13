Verdict: needs-work

# MSAL Node 5.6.0 → 7.2.2

Researched 2026-11-13. **Do not automatically raise this pin:** a scratch installation of the candidate reproduces a product regression. Microsoft grant refusals become `unreachable` instead of `refused`. The package installs, but the adapter depends on class identity shared with the MCP server; this major-version bump breaks that assumption.

## 1. Installability and upstream changes

### Requirements and breaking changes

Both versions declare Node `>=20`; the actual archive pin is **22.21.1** in `runtime/profiles/integrations/artifact-lock.json` (also core), so the candidate's engine requirement is satisfied. The development test Node is separately 22.23.2. No new OS, CPU or optional dependency restriction is declared. [R1, R2]

Upstream changes reviewed in the changelogs and the published tarballs' `src/` diff (12 changed/added/deleted source files):

- **6.0.0:** `acquireTokenInteractive` defaults to `form_post`; removes `loopbackClient` and `ILoopbackClient`. Common 16.14 removes legacy environment metadata/authority support and adds tenant-region-subscope and public-client DPoP contracts.
- **7.0.0:** removes interactive `responseMode` and requires `form_post` for browser-loopback authentication. Matching concurrent silent requests are coalesced, including broker requests.
- **7.0.2/7.1.0:** sanitizes authorization-code payloads and rejects unsupported confidential-client instance-aware inputs.
- **7.2.0:** binds interactive browser responses to per-request state.
- **7.2.2:** consistently sanitizes authorization-code payloads; common 16.16.2 validates authority/region inputs, honors instance-aware code redemption, removes raw state from validation errors and respects PII logging settings in performance exceptions.
- Intermediate common fixes include bidirectional authorization-code nonce validation (16.14.1), refresh-request resource forwarding (16.14.2), case-insensitive response headers (16.15.0), and preservation of ID tokens during account-context cleanup (16.16.1). [R3–R5]

Open Habitat's adapter uses `acquireTokenByRefreshToken`, cache serialization/deserialization, and the MCP server's `acquireTokenSilent`, not MSAL interactive browser-loopback authentication. Thus the headline interactive removals are not themselves the blocker. The shipped adapter uses the supported standard tenant authority. Nonce/code changes are not exercised by this refresh-token import path. [P1]

### Supply chain and licences

Registry inspection found 7.2.2 still tagged `latest`, not deprecated, published **2026-11-12 20:46:45 UTC**, approximately 19 hours before this inspection. It is very young, but no yanking/supersession signal was present. The repository URL and three-entry maintainer list match 5.6.0; no maintainer identities are reproduced here. [R1]

Both MSAL Node versions and the changed common package declare **MIT**. Node's direct dependencies remain `jsonwebtoken ^9.0.0` and exact `@azure/msal-common`, changing from **16.13.0 to 16.16.2**. Common has no runtime dependencies. Neither package declares bundled or optional dependencies or install/postinstall/preinstall hooks; `prepack` is an upstream publication build, not a consumer installation hook. No new dependency names appeared in the scratch lock; it added nested copies of the old MSAL pair for the MCP server. Existing JWT dependencies and the rest of the tool tree were unchanged. Installed MSAL licence files remain MIT. This does not relicense the rest of the integrations bundle. [R1, R2, R6; scratch lock comparison]

Registry signature records exist for the candidate and common. `npm audit signatures` against the scratch candidate tree passed: **213 packages with verified registry signatures, 21 with verified attestations**. Neither candidate MSAL Node nor common's metadata advertises `dist.attestations`: the aggregate 21 attestations are **not** evidence of MSAL build provenance. Registry signature verification authenticates registry package integrity, not the upstream source-to-build relationship. No new MSAL provenance guarantee should be claimed. [R1, R6; experiment below]

### Both archive targets and size

MSAL Node/common are JavaScript packages without native addons or per-target downloads: the same npm tarballs apply to **linux-amd64 and linux-arm64**. The current tree already contains native dependencies elsewhere; this bump adds no new native module or architecture-specific installation step. Builders still require a native host for each target and ignore npm scripts. [R1, R6, P2]

Measured MSAL Node npm download sizes: **460,549 → 483,380 bytes** (+22,831). Registry unpacked sizes: **2,471,026 → 2,573,761 bytes** (+102,735), 341 → 343 files. Common 16.16.2 reports 3,019,673 unpacked bytes. The actual closure increase is larger than the Node-package delta: the MCP server retains a nested Node 5.6.0/common 16.13.0 pair while the root pair is replaced. This duplication affects both targets. Full sealed archive sizes were not measured; they require target builds and cannot be inferred from compressed npm sizes. [R1, R6; scratch lock comparison]

## 2. Required product work and generated inputs

### Confirmed blocker: errors cross two MSAL class identities

`@softeria/ms-365-mcp-server` 0.170.1 requires **`@azure/msal-node ^5.2.2`**. Today it shares the root 5.6.0 installation with the adapter. After changing only the root pin to 7.2.2 and regenerating the lock, npm retains 5.6.0/common 16.13.0 beneath the MCP server. The adapter imports `AuthError` from root 7.2.2/common 16.16.2, but `verifyGrant` receives errors from the MCP server's older classes. Its `error instanceof AuthError` check fails and classifies them as `unreachable`. [P1, P3]

Reproduction in a disposable copy, with scripts disabled and no provider credentials:

1. Copied integrations package/lock, `microsoft-native.mjs`, `microsoft-native.test.mjs` and `synthetic-entra.mjs`.
2. Baseline `npm ci --ignore-scripts --no-audit --no-fund`; `node --test microsoft-native.test.mjs`: **pass**, including import/reload/rotation/refusal and verify states.
3. Candidate copy: changed only root dependency to 7.2.2; `npm install --ignore-scripts --no-audit --no-fund`: **pass**, 213 packages installed.
4. Same test: import/reload/rotation/refusal passed, then **failed at line 97** for synthetic `{refuse:true}`: expected `{state:'refused'}`, actual `{state:'unreachable'}`.
5. Loaded the two MSAL exports through their actual package resolution paths: `root.AuthError === tool.AuthError` was false; `new tool.AuthError('invalid_grant') instanceof root.AuthError` was false.

These experiments ran on development Node 22.23.2, not the archive's 22.21.1. An initial test launch lacked the copied synthetic fixture; the results above are the corrected reruns. No real Microsoft endpoint was used.

**Recommendation:** first make the adapter's error boundary compatible with the MCP server's own MSAL classes, preserving fail-closed code-based classification. Alternatively qualify a newer MCP server that supports the new MSAL major. Do not force a semver-incompatible transitive override merely to remove duplication, and do not start classifying arbitrary exception text as a tenant refusal. Re-run all refusal/outside-tenant/unreachable and native store tests before reconsidering this bump. This is product adaptation, not a mechanical lock update.

### Inputs and generated records for a later qualified bump

- Update integrations `package.json` and regenerate its `package-lock.json`; review nested MSAL copies and exact integrity values. Preserve unrelated locked dependencies.
- Update the explicit root-version assertion in `scripts/test-integrations-runtime.py` (currently 5.6.0). No MSAL-specific version constant was found in `internal/host`; npm closure verification follows the native package lock. `CoreAgentTools` is for Rust tools and is unrelated.
- **No input `artifact-lock.json` SHA-256 changes** are needed for an npm-only change: those locks pin Node and non-npm tools. npm uses lockfile integrity. Rebuilding integrations does change its archive SHA-256, file/component digests, sizes, licence-file records and `artifact.json`; regenerate the release manifest and its trusted digest for delivery.
- Retain npm licence/notice files in the generated closure through `scripts/integrations-runtime-build.py`. No Rust crate lock/licence regeneration or Go-tool notice regeneration is needed when those tools are unchanged. No core/browser lock or web lock change is implied.
- The carried `ms-365-mcp-server-scopes.json` patch targets the pinned MCP server's endpoint metadata and is applied by `patch_ms365_scopes` in `scripts/integrations-runtime-build.py`; preserve its exact-match guard. There is no carried MSAL source patch. A simultaneous MCP server upgrade must separately requalify that patch. [P2–P5]

### Focused checks required after adaptation

- Candidate `bin/node microsoft-native.test.mjs` in a **disposable built-runtime copy** with the synthetic fixture files, as specified in `TESTING.md`; require every error-state assertion, not just import success.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`; qualify `TestMicrosoftSingleGrantNativeRuntime` and `TestMicrosoftMCPToolsPinnedServer` with their documented runtime inputs. These cover native cache interoperation and the pinned server's tools; ordinary mocked Go tests alone cannot catch the class-identity problem.
- `python3 scripts/test-profile-runtime-build.py`; build integrations with `scripts/build-profile-runtime.sh --target linux-amd64 integrations NEW_ABSOLUTE_OUTPUT` and separately `linux-arm64` on matching hosts; run `scripts/test-integrations-runtime.py BUILD CORE_RUNTIME` for each.
- Run release closure tests (`go test ./internal/host -run TestReleaseClosure`, with repository test prerequisites), then generate/verify the manifest over the rebuilt artifacts. This proves sealed lock/licence/digest membership; no live-provider claim follows. [P2, P4, P5]

No archive build, mapped-UID run or live consent test was performed for this report. Since the synthetic native regression already blocks a mechanical bump, those are later qualification work rather than evidence of success here.

## 3. Product features touched

- **Microsoft single-grant connection and encrypted native cache handoff:** `runtime/profiles/integrations/microsoft-native.mjs` (`application`, `importGrant`) and `microsoft-native-cli.mjs`; daemon orchestration in `internal/daemon/integrations/microsoft_linux.go` invokes the adapter during connection.
- **Microsoft connection health, revoked/expired grants and outside-tenant diagnosis:** `verifyGrant`/`classify` in the adapter and the verification path in `microsoft_linux.go`. The reproduced failure disguises a definite refusal as a temporary reachability failure, so the product cannot reliably direct the person to reconnect.
- **Agent access to Microsoft mail, calendar and contacts:** the shipped `ms-365-mcp-server` consumes the native MSAL cache, refreshes tokens and serves tools. With this isolated bump, its own MSAL stays on 5.6.0: it does not automatically gain the new-major improvements.
- **OneDrive/SharePoint/Teams file connection** shares Microsoft's grant/health orchestration (`microsoft_linux.go`, `microsoft_files_linux.go`, `microsoft_recover_linux.go`), but rclone's own OAuth implementation/binary is not upgraded by this npm pin. Browser gateway sign-in and Pi model-provider login do not use this MSAL adapter. [P1, P3, P5]

## 4. New capabilities: proposals only

- **Concurrent silent-refresh coalescing:** upstream can collapse identical in-flight requests on one application instance. Useful if a future long-lived Microsoft integration worker shares an MSAL instance; current short-lived adapter invocations do not acquire cross-process coalescing, and the MCP server remains on v5. Any such worker needs an explicit lifecycle/ownership design, not an incidental dependency bump. [R3, R5]
- **DPoP-related public-client contracts and tenant-region-subscope metadata:** common adds the request/cache/result plumbing and Node explicitly wires its default token-binding manager. This is not evidence that this product can simply switch to proof-bound tokens. Supporting it requires a qualified key manager, protected per-user keys, resource-request proof generation and provider/cache-rotation tests. Region metadata could support future cloud diagnostics, but needs a deliberate UI/telemetry privacy design; no present feature requires it. [R3–R5]
- **Safer native interactive authentication:** upstream's state-bound `form_post` loopback flow could serve a future standalone CLI login. Open Habitat would need to design the browser-to-user-process callback boundary; do not replace the current daemon-mediated single grant with a second consent flow during a bump. [R3, P1]

## 5. Verdict and evidence limits

**needs-work**, not `hold`: no newly identified licence, registry-signature, engine or architecture blocker; a concrete adapter regression makes automatic adoption unsafe. Repair/qualify the MSAL/MCP error boundary, then retest the candidate. Its recent publication and absent MSAL provenance attestation are supply-chain facts to retain, not proof of maliciousness.

Only this report changes repository contents. Report validation: `git diff --check` and `python3 scripts/validate-project-view.py`. Candidate install/signature verification and baseline/candidate synthetic results above are research experiments, not release acceptance.

## Sources

Upstream sources retrieved 2026-11-13:

- **R1:** [npm MSAL Node registry metadata](https://registry.npmjs.org/@azure%2fmsal-node), versions 5.6.0, 6.0.0, 7.0.0 and 7.2.2, publication timestamps/dist-tags/signatures.
- **R2:** [5.6.0 published tarball](https://registry.npmjs.org/@azure/msal-node/-/msal-node-5.6.0.tgz) and [7.2.2 published tarball](https://registry.npmjs.org/@azure/msal-node/-/msal-node-7.2.2.tgz): package manifests, licences, sizes and source diff.
- **R3:** [MSAL Node changelog](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/CHANGELOG.md), 6.0.0–7.2.2 sections and linked upstream PRs.
- **R4:** [MSAL common changelog](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/CHANGELOG.md), 16.14.0–16.16.2 sections.
- **R5:** R2 source files `ClientApplication.ts`, `PublicClientApplication.ts`, `ConfidentialClientApplication.ts`, `SilentRequestCoalescer.ts`, `LoopbackClient.ts`, `InteractiveRequest.ts` and `NodeStorage.ts`; compared directly rather than relying only on release prose.
- **R6:** [MSAL common 16.16.2 registry metadata](https://registry.npmjs.org/@azure%2fmsal-common/16.16.2), and installed licence files from the signature-verified scratch tree.

Repository sources:

- **P1:** `runtime/profiles/integrations/microsoft-native.mjs`, `microsoft-native-cli.mjs`, `microsoft-native.test.mjs`, `synthetic-entra.mjs`.
- **P2:** `runtime/core/artifact-lock.json`, `runtime/profiles/integrations/artifact-lock.json`, `scripts/build-profile-runtime.sh`, `runtime/profiles/AGENTS.md`.
- **P3:** `runtime/profiles/integrations/package.json`, `package-lock.json`; candidate lock regenerated only in scratch.
- **P4:** `scripts/integrations-runtime-build.py`, `scripts/test-integrations-runtime.py`, `runtime/profiles/integrations/ms-365-mcp-server-scopes.json`, `internal/host/release_closure_linux.go`.
- **P5:** `TESTING.md` (Integration tools and Microsoft native single-grant qualification), `docs/operations.md` (Build and verify runtime archives), and Microsoft integration paths named above.
