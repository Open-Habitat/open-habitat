Verdict: needs-work

# Microsoft 365 MCP runtime: 0.170.1 → 0.190.5

Researched 2026-11-23, against product revision `0780c0a0c5d3c9bd6df410754eab5575e188791a`. **Do not schedule this as a mechanical pin bump.** The candidate installs, but the existing native grant test reproduces a product regression: a refused token refresh becomes `unreachable` rather than `refused`. The candidate requires MSAL 7 while the product adapter pins MSAL 5; the two copies have different `AuthError` constructors. There are also deliberate upstream tool-contract changes and a changed preset surface to review. No repository pin or lock was changed in this research.

## 1. Installability and upstream changes

### Runtime and dependency compatibility

Both releases declare Node `>=18`, MIT, the same upstream repository, and no package install/postinstall scripts. The integrations archive actually pins **Node 22.21.1** for both targets in `runtime/profiles/integrations/artifact-lock.json`; do not substitute the development Node version in `TESTING.md` for that pin. The candidate's resolved MSAL 7.2.3 requires Node `>=20`, which that runtime satisfies. A scratch lock update and `npm ci --ignore-scripts --no-audit --no-fund` both succeeded. [U1, U2; R1]

Declared dependency changes are:

- `@azure/msal-node`: `^5.2.2` → `^7.1.1`.
- `zod`: `^3.24.2` → `^4.6.7`.
- `@modelcontextprotocol/sdk`: `^1.29.0` → `^1.32.0`.
- Remove direct `zod-to-json-schema`.
- No newly named direct dependency; optional keytar/Azure dependencies are unchanged. [U1, U2]

Updating a **copy of the product lock**, rather than resolving an unrelated fresh project, changed four package entries: the server, root Zod to 4.6.7, and new nested `@azure/msal-node@7.2.3` / `@azure/msal-common@16.17.0`. The existing root MSAL stays at 5.6.0 with common 16.13.0. The MCP SDK was already sufficiently new in the product lock. Package entries increase from 211 to 213; none are removed. This is the observed resolution on the research date, not a request to use floating versions in the committed lock. [U1, U2; R1; scratch lock comparison]

**Confirmed blocker:** `runtime/profiles/integrations/microsoft-native.mjs` imports `AuthError` and `PublicClientApplication` from the root MSAL, but imports `AuthManager` from the server. Its `classify()` rejects anything not `instanceof AuthError`. The candidate's AuthManager throws errors from its nested MSAL 7, so the adapter treats actual grant refusals as network unavailability. This affects reconnect/health classification, not just test spelling. [R2; U3, `src/auth.ts`]

The unmodified `microsoft-native.test.mjs`, with its helper, CLI and synthetic Entra transport copied alongside each scratch install, gave:

| Dependency set | Runtime used | Result |
| --- | --- | --- |
| Existing product lock | Digest-verified Node 22.21.1, Linux arm64 | Pass, exit 0 |
| Candidate-only pin change | Same Node 22.21.1, Linux arm64 | Fail, exit 1 at line 81: `discovery must not mask a refused tool acquisition`; actual `unreachable`, expected `refused` |
| Candidate-only pin change | Development Node 22.23.2, Linux arm64 | Same failure |

Import, cache reload and rotation checks passed before the candidate failure. This narrows the observed regression; it does **not** establish every later test or cross-version cache scenario. Recommended implementation direction: deliberately align the adapter and server on one reviewed MSAL version, retain typed error classification, and rerun all native grant tests. Do not simply remove the type guard or relabel every error as a revoked grant. That dependency/adapter change belongs in the follow-up, not this report. [R2; synthetic execution]

### Behaviour and contract changes that matter here

The upstream comparison contains 70 commits and 110 changed files. Release notes alone understate compatibility work because several changes are labelled fixes, not breaking releases. Published tarball endpoints and generated modules were compared as well as source patches. [U3, U4]

- **Mail deletion changes wire operation and result.** `delete-mail-message` changes from `DELETE /me/messages/{id}` to `POST /me/messages/{id}/move` with `destinationId: deleteditems`. It returns the moved message with a new ID; deleting a message already in Deleted Items now leaves it there. The final candidate names the separate stronger operation `delete-mail-message-skip-deleted-items`, although an intermediate release note calls it `permanently-delete-mail-message`. Trust the final endpoint contract. Open Habitat already exposes the first tool, so review confirmation/result handling rather than silently changing its semantics. [U3, U4; published `dist/endpoints.json`; R3]
- **Presets change.** Importing `getCombinedPresetPattern(['mail','calendar','contacts'])` from the two installed versions shows additions `delete-mail-message-skip-deleted-items`, `list-rooms`, and the account tools `login`, `logout`, `list-accounts`, `select-account`, `remove-account`, `verify-login`. No prior names disappear from that combined surface. The product's `TestMicrosoftMCPToolsPinnedServer` explicitly compares this surface with `microsoftOutlookTools`, so its current expectation cannot pass unchanged. Do not copy the upstream list wholesale: account lifecycle remains product-owned. Decide what the product intentionally exposes, then adjust the assertion to preserve that decision. [U3, `src/tool-categories.ts`; R3, R4; module comparison]
- Account tools now respect `--enabled-tools`, `--read-only`, and token-only operation. The product passes its own anchored allowlist, not an upstream preset. This reduces accidental tool exposure, but tests must exercise the actual filtered surface and its area routing. [U3, `src/auth-tools.ts`, `src/server.ts`; R3]
- `download-bytes-to-file` is no longer advertised as read-only because it writes locally. Open Habitat explicitly includes it and instructs agents to fetch files with it; review its MCP annotation through the permission path. The product command uses `--allowed-scopes`, not `--read-only`, so this annotation correction alone does not imply that read-grant users lose downloads. [U3, U4; R3, R5]
- Tool schema generation migrates to Zod 4, limits tool-definition size and argument element counts, preserves explicit PATCH bodies over flattened fields, and changes pagination/document-read guidance. These need real generated-tool fixtures, not just a successful `--version`. SharePoint site search rejects wildcard terms. [U3, U4]
- Other upstream removals/renames are outside the current allowlist: `reply-to-chat-message`, `list-chat-message-replies`, and the long `list-sharepoint-site-onenote-section-group-section-groups` name (replaced by a shorter child-section-groups name). No current allowlisted name was identified as removed. [U3; published endpoint comparison; R3]
- HTTP OAuth now defaults dynamic client registration off and supports Client ID Metadata Documents; application permissions, managed identity and federated credentials are opt-in. Open Habitat's existing per-account child is stdio/delegated, not an HTTP OAuth server. These changes do not require enabling a new transport or credential authority for the bump. The final 0.190.5 fix returns HTTP 503 for a temporarily unfetchable client metadata document. [U3, U4; R3]

### Licence and supply-chain observations

The two published top-level LICENSE files are byte-identical MIT. Neither manifest declares bundled dependencies. In the scratch product lock, existing package licence declarations are unchanged; both new nested Azure packages are MIT. The candidate closure's declarations are MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, Python-2.0, 0BSD, `(MIT OR WTFPL)` and `(BSD-2-Clause OR MIT OR Apache-2.0)`. There is no observed new licence family. This is a manifest/retained-file comparison, not a legal opinion or a full source audit of every dependency. The builder must still retain each installed package's notices/licence files. [U1, U2; R1, R6; scratch lock/tarball inspection]

At registry retrieval around 12:41 UTC on 2026-11-23, `latest` was 0.190.5, published **2026-11-23 11:00:51 UTC**: approximately 100 minutes old. The previous pin was published 2026-10-17 12:56:20 UTC. Neither version was marked deprecated. The candidate was available, not observed yanked or superseded. The short age provides little deployment history, not by itself evidence of compromise. [U1, U2]

Repository and maintainer lists match between the two version records. Both tarballs matched the registry SHA-512 integrity values. Both versions carry two registry signatures under key ID `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`; all four signatures verified using Node crypto against the registry's public key and the signed `name@version:integrity` string. That proves the registry signature over those bytes, not source correctness. [U1, U2, U5; local verification]

The candidate supplies npm publish and SLSA v1 provenance attestations. The decoded provenance subject matches the downloaded SHA-512 and identifies the same repository, `.github/workflows/release.yml`, GitHub-hosted runner, and commit `e9ea43f78b03e98e788e596d0e4244382a4e008f` (also the version record's `gitHead`). **Full attestation-chain verification remains unproved:** `npm audit signatures` failed with a registry read timeout for `@azure/abort-controller`; it was not a signature-invalid result and must not be reported as a passed closure audit. [U6; local attestation inspection and audit attempt]

Only keytar 7.9.0 declares an install script in the candidate product lock, unchanged from baseline. The builder already uses `npm ci --ignore-scripts`; the daemon explicitly sets `MS365_MCP_USE_KEYTAR=false`. No candidate package lifecycle downloader is introduced. [U1, U2; R1, R3, R6; lock comparison]

### Both archive targets and size

The server tarball is architecture-neutral JavaScript/data; neither version declares an OS/CPU restriction. Both use the same tarball and integrity. Compressed bytes increase **358,091 → 435,290** (+77,199); registry unpacked size increases **1,944,993 → 2,319,838** (+374,845). [U1, U2; verified downloads]

The arm64 scratch `node_modules` regular-file totals increase **61,709,054 → 70,234,911 bytes**, chiefly including the duplicated MSAL tree. These are installed npm-tree measurements, **not sealed archive sizes**. No `.node` binary was present after script-disabled installation. Optional keytar remains a native-capable dependency whose build/download is intentionally skipped and whose use is disabled; do not describe the entire dependency graph as intrinsically native-free. [R1, R6; scratch installation]

For **linux-amd64** and **linux-arm64**, keep the existing target-specific Node download/digest and native-tool pins. This change introduces no new target-specific package download in the observed lock. Both target archives still require rebuilding on native target hosts and closure verification. Only arm64 synthetic Node execution was performed here; no complete integrations archive, amd64 execution or final compressed-archive size is claimed. [R1, R6; `docs/operations.md`, “Build and verify runtime archives”]

## 2. Work required when raising the pin

1. Update `runtime/profiles/integrations/package.json` and regenerate its `package-lock.json` using script-disabled npm. Address the root/nested MSAL mismatch deliberately and review the final resolved dependency/licence delta again. A candidate-only lock was useful evidence, not a ready-to-commit solution. [R1, R2]
2. Carry the **scope patch** in `ms-365-mcp-server-scopes.json`: its version currently rejects anything but 0.170.1. All 15 existing `from` field sets still match the candidate endpoints exactly. Raise the patch version only after reviewing its retained `to` semantics and the new schema; do not drop the broad file/search scope adjustments. `patch_ms365_scopes` rejects wrong versions and changed upstream fields. No other source patch to this npm package was found in the integration builder. [R6; patch/candidate comparison]
3. Review deletion semantics, the extra preset names, and download write annotations through product tool routing/confirmation. Update `scripts/test-integrations-runtime.py`'s literal server version and the intentional preset assertion, without silently adding account tools or stronger deletion to the allowlist. [R3–R5, R7]
4. **No input `artifact-lock.json` SHA-256 update is required solely for this npm bump.** The server is pinned by npm lock integrity; the integrations artifact lock owns Node and separate native tools. Rebuild to regenerate archive SHA-256, component/file inventory and release descriptors/manifest. Retain all package licences/notices through the builder. Existing checked-in notices for unrelated native tools need not be regenerated unless their pins change. [R1, R6]
5. **No Rust crate/licence record, core browser lock, web npm lock or core version constant is implicated by this package alone.** Rust locks and `CoreAgentTools` belong to independent core tools. The release closure verifies optional npm components against their carried native lock; no separate 0.170.1 constant was found under `internal/host/release*`. Do not regenerate unrelated records to hide dependency churn. [R1, R6; `runtime/core/AGENTS.md`; `internal/host/release_closure_linux.go`]

Focused implementation evidence should include:

- `python3 scripts/test-profile-runtime-build.py` for builder/patch/target rules.
- The complete `microsoft-native.test.mjs` against the actual candidate dependency tree and archive Node, proving refusal versus outage, tenant mismatch, refresh rotation and native cache reload. Include a baseline-to-successor cache migration case when changing the root MSAL pin. [R2]
- Native `build-profile-runtime.sh integrations NEW_OUTPUT --target linux-amd64` and `--target linux-arm64`, then `python3 scripts/test-integrations-runtime.py INTEGRATIONS_OUTPUT CORE_RUNTIME` with the target-matching core runtime. [R6, R7]
- `OH_TEST_MICROSOFT_RUNTIME=...` with `TestMicrosoftMCPToolsPinnedServer`, plus `OH_TEST_RCLONE=...` for `TestMicrosoftSingleGrantNativeRuntime`; inspect skips. These cover generated file-write calls, offered/denied tools and native grant handling. [R4; `internal/daemon/integrations/microsoft_native_linux_test.go`]
- Focused Go integration/daemon tests and Microsoft permission tests for area routing, confirmation, registration alignment and reconnect. `go test ./internal/host -run TestReleaseClosure` plus `runtime-release manifest`/`verify` over the **new** integrations archive prove packaging/lock/notice closure, not provider consent or live Microsoft behaviour. Follow `TESTING.md` for prepared test dependencies. [R3–R7; `TESTING.md`]

## 3. Product features touched

- **Microsoft account connect, verify, reconnect and removal:** `runtime/profiles/integrations/microsoft-native{,-cli}.mjs`, `internal/daemon/integrations/microsoft_linux.go`, `microsoft_reconnect_linux.go` and `microsoft_recover_linux.go`. The adapter imports the server's internal auth/cache modules, so CLI compatibility alone is insufficient. [R2, R3]
- **Agent mail, calendar, contacts, files and mailbox administration:** `internal/daemon/integrations/microsoft_server_linux.go` registers area-specific Pi MCP entries and binds them to one daemon-owned per-account stdio server. Its tool selection comes from `microsoft_linux.go`. [R3]
- **Write approval and readable action descriptions:** `internal/daemon/microsoft-permission.mjs` and `microsoft_permission_linux.go`; changes to tool names, schemas and annotations reach this path. [R5]
- **OneDrive/SharePoint search and on-demand fetch:** `microsoft_linux.go`'s file allowlists and generated skill text, scope patch, and `testdata/microsoft-file-writes.mjs`. Rclone remains a separate sync binary; this is not a rclone pin change. [R3, R4, R6]
- **Runtime packaging/acceptance:** integration npm inputs, `scripts/integrations-runtime-build.py`, `scripts/test-integrations-runtime.py`, and `internal/host` release closure. No browser contract generation is required merely to change this dependency. [R1, R6, R7]

## 4. New capabilities — separate proposals, not bump scope

1. **Better file discovery and room lookup:** upstream adds `search-files` and `list-rooms`. Evaluate their schemas/scopes, explicitly add selected names to product allowlists, route them to the appropriate area, and extend grant-filtering tests and agent guidance. `search-files` should be compared with the already exposed `search-query`, not assumed necessary. [U3, U4; R3, R4]
2. **Shared-calendar writes and broader collaboration:** new shared-calendar create/update/delete, Planner plan creation/update/listing, Teams channel tabs, OneNote page updates and SharePoint/To Do delta/version tools. Product support needs an intentional tool set, suitable consent, area routing and write-confirmation coverage. Do not widen grants as a side effect of taking upstream endpoints. [U3, U4; R3, R5]
3. **MCP Apps:** opt-in file browser and mail draft/Send views could provide richer interaction. They require an explicit decision about rendering untrusted app resources, sandboxing, MCP UI messages and send approval. The current tool relay/browser must not inherit a new send path just because upstream ships HTML. [U3, U4, `src/mcp-apps.ts` and `src/apps/`; R3, R5]
4. **Application permissions / managed identity / federated credentials:** these can support unattended organisational workflows, but do not fit the existing signed-in-person delegated account model without a credential/authority design decision. Keep them disabled for this bump. [U3, `src/app-mode.ts`; R2, R3]

Upstream also adds enabled-tools files, hybrid eager/discovery registration, bulk file links and inline attachment content IDs. These are opportunities only if they solve an observed product need; the existing allowlist/stdio setup need not adopt them. [U3, U4]

## 5. Verdict and evidence limits

**Needs-work**, not safe-to-bump: the synthetic refusal regression is reproduced on the pinned Node, preset equality changes, and deletion semantics change for an already exposed tool. There is no observed reason to categorically reject the upstream release on licence or package-signature grounds. The bounded next task is MSAL alignment plus deliberate tool-contract adaptation and native archive qualification, not a broad feature expansion.

Performed: registry and release/compare retrieval; tarball integrity and registry-signature verification; provenance payload inspection; source/published endpoint and preset comparison; scratch lock regeneration and script-disabled installation; baseline/candidate native grant tests. Full provenance/closure signature audit was blocked by a network timeout. Complete archive builds, amd64 runtime tests, provider consent, live Graph behaviour, and the proposed fixes were **not** performed. Report landing checks passed: `python3 scripts/validate-project-view.py` (13 pages valid) and `git diff --check`. No issue metadata was changed.

## Sources

Upstream primary sources (retrieved 2026-11-23):

- **U1:** [npm registry package metadata, including version timestamps](https://registry.npmjs.org/@softeria%2fms-365-mcp-server).
- **U2:** [0.170.1 version record](https://registry.npmjs.org/@softeria%2fms-365-mcp-server/0.170.1), [0.190.5 version record](https://registry.npmjs.org/@softeria%2fms-365-mcp-server/0.190.5). Tarballs were downloaded from each record's `dist.tarball` and checked against `dist.integrity`.
- **U3:** [Source comparison v0.170.1…v0.190.5](https://github.com/Softeria/ms-365-mcp-server/compare/v0.170.1...v0.190.5), read through the [GitHub compare API](https://api.github.com/repos/Softeria/ms-365-mcp-server/compare/v0.170.1...v0.190.5); published `dist` modules were inspected independently.
- **U4:** [Upstream releases](https://github.com/Softeria/ms-365-mcp-server/releases), read through the [release API](https://api.github.com/repos/Softeria/ms-365-mcp-server/releases?per_page=50). No `CHANGELOG.md` was available at the candidate tag; release bodies supplied the release notes.
- **U5:** [npm registry signing keys](https://registry.npmjs.org/-/npm/v1/keys).
- **U6:** [Candidate npm attestations](https://registry.npmjs.org/-/npm/v1/attestations/@softeria%2fms-365-mcp-server@0.190.5).

Repository sources (paths at the revision above):

- **R1:** `runtime/profiles/integrations/{package.json,package-lock.json,artifact-lock.json}`.
- **R2:** `runtime/profiles/integrations/{microsoft-native.mjs,microsoft-native.test.mjs,microsoft-native-cli.mjs,synthetic-entra.mjs}`.
- **R3:** `internal/daemon/integrations/{microsoft_linux.go,microsoft_server_linux.go,microsoft_reconnect_linux.go,microsoft_recover_linux.go}`.
- **R4:** `internal/daemon/integrations/microsoft_search_linux_test.go` and `testdata/microsoft-file-writes.mjs` within that directory.
- **R5:** `internal/daemon/{microsoft-permission.mjs,microsoft_permission_linux.go}`.
- **R6:** `scripts/{build-profile-runtime.sh,integrations-runtime-build.py,test-profile-runtime-build.py}`, `runtime/profiles/integrations/ms-365-mcp-server-scopes.json`.
- **R7:** `scripts/test-integrations-runtime.py`, `internal/host/release_closure_linux.go`, `TESTING.md`, and `docs/operations.md`.
