Verdict: needs-work

# Claude Agent SDK 0.3.321 → 0.3.331

Assessed 2026-11-23, approximately 22:15 UTC, against product commit `f5a9e857219737053e5aef0644fcb69552427ae2`. Research only: no runtime inputs changed.

**Recommendation:** resolve the bridge's exact SDK dependency before scheduling this as an automatic bump. The candidate is available for both targets, but changing the root pin alone does not upgrade the provider used for conversations. Prefer a narrowly scoped npm override making the existing bridge use the root SDK, mirrored in the device fixture, followed by the compatibility checks below. That override deliberately departs from the bridge author's exact dependency; this report does not establish its runtime compatibility. Do not silently ship two SDK generations or update the bridge as an unrelated part of this bump. [P1, P3, U3]

## 1. Installability and upstream changes

### Availability and requirements

The live npm registry reported both `latest` and `next` as **0.3.331**, without a deprecation marker. It was published **2026-11-23T18:35:23.545Z**, about 3 hours 40 minutes before this assessment; 0.3.321 was published November 9. The GitHub release was published November 23 at 21:34:31 UTC. The registry, not a cached releases-page listing still headed by 0.3.330, was used to establish current availability. There is little release-age soak time. [U1, U4]

Both versions require Node `>=18.14.0`; the actual core artifact lock pins **22.23.5** for both targets, which satisfies it. Do not use the older Node version mentioned in the general testing instructions as the archive's authority. Entry-point exports and peer ranges are unchanged: `zod ^4.0.0`, `@anthropic-ai/sdk >=0.93.0`, and `@modelcontextprotocol/sdk ^1.29.0`. There are no ordinary dependencies or install scripts in either SDK manifest. The same eight optional native packages remain, each advanced to the matching SDK version. [U1, P1]

### Breaking and behavior changes relevant to review

Upstream explicitly labels 0.3.327's option validation as breaking: `query`, `startup`, and `prewarm` reject unserializable launch options, and hook collections must be arrays rather than Sets, generators or arbitrary objects. Inline SDK MCP servers in individual agent definitions are deprecated and ignored; they belong at top-level `mcpServers`. The bridge provider currently constructs ordinary settings objects and top-level MCP servers, not those deprecated agent-local servers. Source inspection found no necessary option-shape adaptation in that path; it is not an execution proof. [U5, U3]

Other changes requiring focused regression coverage:

- **0.3.323:** permission-check failures after an allowing pre-tool hook now ask `canUseTool`, or deny without it; initialization, compaction/fork history, and MCP progress handling were corrected. Hook progress can name no ordinary parent tool. [U6]
- **0.3.325:** sandboxed Bash is not implicitly approved unless explicitly configured; out-of-workspace untrusted read-only Git commands enter permission flow. SDK MCP deny rules now remove matching tools from the advertised set. The provider exposes Pi tools through MCP and only the product-patched WebSearch/WebFetch as built-ins, so these are not a reason to enable native Bash or change turn permissions. [U7, P2, U3]
- **0.3.326–0.3.330:** MCP reconnect/result correlation changed, was reverted, then fixed again. Final request IDs are numeric and can reach 1,048,576 or more. Test the bridge's hand-built in-process MCP transport against the candidate, not merely a version-string assertion. New `mcpServersDelivery: 'initialize'` is optional; the default remains command-line delivery. Invalid JSON-string settings now fail early. [U8, U5, U9]
- **0.3.328–0.3.329:** interrupt/subagent reporting and idle/replay memory use improve; rewritten shell commands receive their own sandbox decision. Managed-hook load failures and invalid settings can produce informational warnings. [U10, U11, U9]
- **0.3.331:** file rewind respects managed checkpoint disabling and avoids deleting files after failed restoration; foreground task notifications now name their output file. Session listing bounds transcript opens, and modified Edit/Write inputs are reflected in results. New startup refusal reason `sideload_flags_disabled` identifies managed-policy launch rejection. [U4]

The downloaded declaration diff also changes the built-in tool constant from `ProposeGoal` to `SetGoal` and adds settings/types and API fields. The product patch uses an explicit WebSearch/WebFetch list, not that entire constant. The published JS is minified and native implementation is compiled: inspection of declarations, manifests and release notes is not a complete native source audit. [U2, P2]

### Supply chain and licensing

Downloaded the old and candidate SDK wrapper plus **both glibc Linux native packages**. All six tarballs matched their registry SHA-512 integrity. For all six, both supplied registry signatures verified cryptographically against the live npm key endpoint using the signed `name@version:integrity` message and key ID `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. These duplicate signatures use the same key, not independent publishers. Candidate native binary SHA-256 values also matched the SDK's bundled `manifest.json`. [U1, U2, U12]

None of those six version documents advertises `dist.attestations`. Thus **registry signing was verified; source/build provenance attestation was not available through that metadata and was not verified**. Signing establishes registry integrity, not reproducibility or benign behavior. SDK maintainer and publishing-identity metadata compare equal between the two versions; repository remains the same upstream TypeScript SDK repository. No new install scripts or dependency names were found in the three package manifests compared per version. [U1, U12]

Top-level licence declarations are unchanged: SDK `SEE LICENSE IN README.md`, native packages `SEE LICENSE IN LICENSE.md`. Their shipped `LICENSE.md` files are byte-identical across versions and retain proprietary Anthropic terms, not an MIT licence. The SDK README's licensing/legal references are unchanged. This is a no-observed-packaged-licence-change finding, **not a new legal approval of redistribution**. [U2]

Bundled dependencies need more careful wording than “no dependencies changed”: the root JS bundles dependency code while `/core` uses external peers, and the native binaries embed their runtime. The packages do not supply a complete versioned third-party SPDX/SBOM closure. A retained `mime-types` MIT banner in the old `bridge.mjs` is absent from the new JS modules; that alone does not establish removal of the dependency or a licence violation. Consequently, identical top-level licences and peer ranges do **not** prove unchanged embedded dependency licences. Preserve all shipped notices in regenerated inventory and review any upstream notice clarification; do not invent crate records for these opaque binaries. [U2, P4]

### Both archive targets

Ubuntu uses the glibc optional packages: `linux-amd64` selects `linux-x64`, and `linux-arm64` selects `linux-arm64`. They ship precompiled ELF `claude` executables, not Node addons requiring node-gyp or a local compiler. Both versions' inspected ELF symbol requirements top out at `GLIBC_2.26`; architecture and interpreter families are unchanged. That static check is not native execution qualification. No postinstall download is needed for these three packages. [U1, U2]

Measured bytes from integrity-checked tarballs (compressed download / npm unpacked size):

| Package | 0.3.321 | 0.3.331 |
| --- | ---: | ---: |
| SDK wrapper | 1,507,185 / 5,182,471 | 1,528,095 / 5,186,114 |
| Linux x64 native | 159,254,839 / 341,910,621 | 184,581,466 / 398,623,581 |
| Linux arm64 native | 160,278,961 / 341,501,965 | 185,592,445 / 397,534,989 |

The intended single-version update adds approximately **25.3 MB download and 56–57 MB unpacked per target**. Cause of the native growth was not established. These are package measurements, not measured final `core.tar.gz` sizes. The naive two-version dependency graph retains the old native package as well, adding another roughly 342 MB unpacked rather than replacing it. Rebuild both native-target archives; do not reuse an old core archive. [U1, U2, P1, P4]

## 2. Product work and checks before raising the pin

### Observed blocker: two effective SDK versions

`runtime/core/package.json` directly pins 0.3.321, but `pi-claude-bridge@0.12.0` also depends **exactly** on 0.3.321. A disposable two-dependency `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` with the root changed to 0.3.331 succeeded and produced:

```text
node_modules/@anthropic-ai/claude-agent-sdk                                      0.3.331
node_modules/pi-claude-bridge/node_modules/@anthropic-ai/claude-agent-sdk         0.3.321
node_modules/@anthropic-ai/claude-agent-sdk-linux-x64                            0.3.331
node_modules/pi-claude-bridge/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64 0.3.321
```

This is a minimal resolution reproduction, not an install or a regenerated product lock. The bridge imports the SDK from its own source, so it resolves the nested old dependency. Meanwhile `internal/daemon/claude_login_linux.go` locates the top-level native package for login/status. A root-only bump would split authentication tooling and conversation runtime generations. [U3, P3]

### Required edit and regeneration scope

1. Raise the core SDK pin **and resolve the bridge dependency**. Recommended implementation is a targeted override of the bridge's SDK to the direct root SDK; prove resolution from the bridge's actual source location. Regenerate `runtime/core/package-lock.json` with scripts disabled, retaining all platform optional records and reviewing unrelated peer churn. Assert there is one SDK generation, rather than accepting a nested 0.3.321.
2. Update the candidate test dependency graph in `internal/daemon/pi-device-test/package.json` and its lock. Currently the fixture obtains 0.3.321 transitively from the bridge. Passing its unchanged tests says nothing about 0.3.331. Mirror the intended override/resolution explicitly.
3. Raise the exact accepted SDK version in `internal/host/release_closure_linux.go` and corresponding fixture in `release_closure_linux_test.go`. Do not alter unrelated versions or `CoreAgentTools`.
4. Carry `runtime/core/bridge-patch.json` unchanged unless a separately selected bridge release supersedes it. The patch's old text matched the downloaded 0.12.0 source **exactly once**. It gates built-in WebSearch/WebFetch with the companion's turn mode; the SDK update is not permission to remove that guard.
5. Build fresh core archives and regenerate their `artifact.json` component/file/licence records, archive digests and the final release manifest/digest. The builder copies npm notices and records the lock-derived versions and file membership.
6. **No SDK hash lives in `runtime/core/artifact-lock.json`:** npm SHA-512 integrity is in `package-lock.json`. The Node and Rust-tool SHA-256 pins there do not change for this SDK-only update. Taskfleet/workmux Cargo.lock and crate/licence records, Go tool notices in integrations, Ubuntu declarations, `runtime/core/browser-lock.json`, and `web/package-lock.json` likewise do not need unrelated regeneration. Chromium/Playwright is not upgraded by this proposal. [P1–P5]

### Focused proof for the implementation worker

- Inspect the regenerated graph and resolve the SDK from both the bridge and top-level login path; require candidate-native package/version agreement on both architectures.
- With candidate fixture dependencies installed, run `node --test internal/daemon/pi-device-test/bridge-tools.test.mjs internal/daemon/pi-device-test/bridge-transcript.test.mjs internal/daemon/pi-device-test/models.test.mjs`. These cover patched built-in tool gating, Pi tool dispatch, transcript handling and native model/auth plumbing. The fake-Claude bridge cases are not live-provider proof; include an SDK MCP handshake/tool-result roundtrip, reconnect/correlation case and invalid-option refusal if existing coverage does not exercise them.
- Run `./scripts/test-focused.sh --area go --go-package ./internal/daemon` and `./scripts/test-focused.sh --area go --go-package ./internal/host`, with the fixture actually at the candidate. Relevant release cases include `TestReleaseClosure`, `TestReleasePlatformPackages`, `TestReleaseExecutableArchitecture` and `TestReleaseNPMLockCPU`.
- Run `python3 scripts/test-profile-runtime-build.py`; build new core outputs with `scripts/build-core-runtime.sh --target linux-amd64 OUTPUT` and the corresponding `linux-arm64` command on native hosts. For each output, run `OH_CORE_ARTIFACT_DIR=OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore`, and verify the release manifest through `runtime-release` as documented. Exercise native CLI startup/version/auth-status in a synthetic home without real credentials.
- Where available, use `OH_PI_ARTIFACT_DIR=OUTPUT ./scripts/test-real-pi-controller.sh` for mapped-UID controller evidence. It does not establish a real Claude subscription/model turn. Live-provider acceptance, full native builds and installed-user isolation were **not run in this research**. [P4, P5]

## 3. Product features touched

| Feature | Product paths and upstream dependency |
| --- | --- |
| Claude sign-in and login status | `internal/daemon/claude_login_linux.go`, `pi_device_linux.go`: invokes the architecture-specific native executable. |
| Claude model availability and selection | `internal/daemon/pi_models_linux.go`, `pi_credentials_linux.go`, `pi-device-test/models.test.mjs`; bridge model probing launches the SDK. |
| Streaming Claude conversations, tool results, abort/resume and usage | `internal/daemon/pi_rpc_linux.go`, packaged `pi-claude-bridge/src/index.ts`, `query-state.ts`, `mcp-server.ts`, `usage.ts`; upstream reconnect/history changes reach these paths. |
| Participant/text-only/approval tool policy and provider web search | `internal/daemon/process-extension.mjs`, `runtime/core/bridge-patch.json`, `pi-device-test/bridge-tools.test.mjs`; built-in search bypasses Pi dispatch and must stay disabled in restricted turns. |
| Transcript damage recovery and continuation | `internal/daemon/process-extension.mjs`, `pi-device-test/bridge-transcript.test.mjs`, upstream bridge transcript/session handling. |
| Install/upgrade payload acceptance | `scripts/core-runtime-build.py`, `internal/host/release_closure_linux.go`; version, CPU, notices and file inventory checks. |

This is the Claude bridge path, not an upgrade to Pi's separate Anthropic API provider or a switch to the SDK's browser/remote-session architecture. [P1–P5, U3]

## 4. Optional capabilities, not bump scope

- **Actionable startup/policy warnings:** expose newly structured informational warnings and `sideload_flags_disabled` as useful conversation errors. Would require bridge event mapping, daemon error sanitization, browser-contract/UI decisions and tests; do not leak raw config paths or settings into browser errors. [U4, U9, U11]
- **Session archive APIs:** upstream adds archive/unarchive and an `archived` session field. Useful only if the product deliberately exposes native Claude session management; Habitat's Pi session authority must not be replaced by a parallel Claude registry. Requires explicit lifecycle mapping and UI behavior, not merely calling the new API. [U7, P3]
- **Stdin MCP configuration delivery:** `mcpServersDelivery: 'initialize'` can keep stdio/HTTP server environment/header configuration off argv. The present bridge's in-process SDK servers are unaffected. Evaluate for future external MCP integration, including custom-Claude-executable compatibility; not an automatic setting change here. [U8, U2, U3]
- **Policy-aware model presentation:** alpha `matchDeniedModels()` and `resolveSettings().machinePolicy.didNotLoad` could improve diagnostics. Requires bridge/model-catalog integration and careful distinction between UI hints and enforcement: the matcher is not an authorization authority. [U6, U2]

## 5. Verdict and evidence limits

**Needs-work, not hold:** no observed registry-integrity failure, yanking, superseding release, platform loss or top-level licence change. The concrete blocker is dependency ownership: an unqualified root pin/lock update leaves provider calls on 0.3.321. Adopt and test an intentional single-generation graph before reassessing as safe-to-bump. Native growth, young release age and unavailable provenance/SBOM evidence remain visible limitations, not invented proof of compromise.

Completed research checks: six tarball integrity checks, twelve registry-signature checks, both candidate native-manifest digest comparisons, package/declaration/licence diffs, ELF architecture/GLIBC inspection, minimal npm resolution reproduction and exact-once bridge-patch check. No model calls, product dependency installs, archive builds or live-account tests were performed. Report validation: `git diff --check` and `python3 scripts/validate-project-view.py`.

## Sources

Upstream links identify the material fetched for this assessment; tarball observations refer to the exact version's registry `dist.tarball`, verified against `dist.integrity`.

- **U1 — registry metadata:** [complete SDK version/timestamp record](https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk), [0.3.321](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/0.3.321), [0.3.331](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/0.3.331), [x64 candidate](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-x64/0.3.331), [arm64 candidate](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-arm64/0.3.331). Old native records use the same package endpoints with version 0.3.321.
- **U2 — published package diff:** integrity-checked SDK and native tarballs named by U1; compared `package.json`, `README.md`, `LICENSE.md`, `sdk.d.ts`, JS module layout, native `claude` and bundled `manifest.json`. [SDK old tarball](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.321.tgz), [SDK candidate tarball](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.331.tgz).
- **U3 — bridge dependency and implementation:** [pi-claude-bridge 0.12.0 metadata](https://registry.npmjs.org/pi-claude-bridge/0.12.0) and its published tarball, particularly `package.json`, `src/index.ts`, `src/mcp-server.ts` and `src/config.ts`.
- **U4 — candidate notes:** [v0.3.331](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.331); live [GitHub releases API](https://api.github.com/repos/anthropics/claude-agent-sdk-typescript/releases?per_page=20).
- **U5 — breaking validation changes:** [v0.3.327](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.327).
- **U6 — policy, progress and history:** [v0.3.323](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.323).
- **U7 — archives and permissions:** [v0.3.325](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.325).
- **U8 — MCP delivery and reconnect:** [v0.3.326](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.326).
- **U9 — final reconnect/settings behavior:** [v0.3.330](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.330).
- **U10 — hooks, interrupts and policy:** [v0.3.328](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.328).
- **U11 — memory and managed warnings:** [v0.3.329](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.329).
- **U12 — verification key:** [npm public signing keys](https://registry.npmjs.org/-/npm/v1/keys).

Product sources at the assessed commit:

- **P1:** `runtime/core/package.json`, `package-lock.json`, `artifact-lock.json`, `browser-lock.json`, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`.
- **P2:** `runtime/core/bridge-patch.json`, `internal/daemon/process-extension.mjs`, `internal/daemon/pi-device-test/bridge-tools.test.mjs`.
- **P3:** `internal/daemon/pi-device-test/package.json`, its lock and tests; `internal/daemon/claude_login_linux.go`, `pi_device_linux.go`, `pi_models_linux.go`, `pi_credentials_linux.go`, `pi_rpc_linux.go`.
- **P4:** `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, `internal/host/release_closure_linux.go`, `release_closure_linux_test.go`.
- **P5:** `TESTING.md`; `docs/operations.md`, “Build and verify runtime archives”.
