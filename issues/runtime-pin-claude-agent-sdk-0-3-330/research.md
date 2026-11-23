Verdict: needs-work

# Claude Agent SDK 0.3.321 → 0.3.330

Assessed 2026-11-23 against repository commit `3d6f13f67`. No runtime input was changed.

**Recommendation:** first align the bridge's SDK dependency, then qualify the candidate. A root-only bump does not upgrade the SDK used by the product: `pi-claude-bridge@0.12.0` requires exactly `0.3.321`. A disposable lock regeneration reproduced a nested old SDK and its eight platform packages under the bridge, alongside the new root SDK. Node resolves the bridge's import to that old copy. This is a concrete dependency-selection problem, not evidence of an upstream regression. Prefer a bridge release declaring the candidate; otherwise explicitly approve and test a narrowly scoped dependency override. Do not silently ship both and call the bridge upgraded. [R1, R2, U4]

## 1. Installability and upstream changes

### Runtime and dependency graph

Both wrappers require Node `>=18.14.0`; the **packaged** Node is `22.21.1` on both targets (not the development-test Node mentioned in TESTING.md). Peer requirements are unchanged: `@anthropic-ai/sdk >=0.93.0`, `@modelcontextprotocol/sdk ^1.29.0`, and `zod ^4.0.0`. There are no regular dependencies or lifecycle scripts in either SDK wrapper or the four inspected Linux platform packages. The same eight optional platform packages remain, with their versions advanced together. A scratch copy of the current manifests, changing only the root SDK pin, regenerated successfully with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`; it added no non-SDK package paths and changed no other package versions. It emitted an existing Pi-settings peer-range warning. This is resolution evidence, not an installed runtime test. [U1–U4, R1]

The tarball comparison found unchanged export subpaths; the wrapper grows from 21 to 30 files, principally split `core-*.mjs` chunks. Public declarations and implementation bundles change. The native executable changes on each target; native README and LICENSE files are byte-identical. Published JavaScript/types and binary manifests were compared directly: the public GitHub repository is not a complete source diff of the compiled Claude Code engine. [U1–U3]

### Breaking and behavior changes to check

The range includes changes that cannot be dismissed merely because the version is a patch:

- **0.3.327 explicitly breaks invalid option inputs:** `query`, `startup`, and `prewarm` reject non-serializable option values; hook event values and matcher hook collections must be arrays. Agent-local in-process SDK MCP servers are deprecated and ignored with a warning; they belong in top-level `mcpServers`. The bridge's inspected provider call uses object settings and a top-level MCP map, not agent-local servers or non-array hooks. No required adaptation was found in that call shape. [U7, U4]
- **0.3.330** rejects malformed JSON-string settings; settings-validation failures now produce informational diagnostics. SDK MCP reconnect result routing is fixed, with numeric request IDs potentially at least 1,048,576. The intermediate string-ID change in 0.3.326 was reverted in 0.3.327; do not build an adaptation to that transient behavior. [U6, U7, U10]
- **0.3.325** stops automatically approving sandboxed Bash unless explicitly enabled, routes some formerly auto-approved read-only git commands through permissions, changes permission suggestions, and rejects invalid `applyFlagSettings` updates atomically. **0.3.328** changes sandbox selection after a PermissionRequest command rewrite. The provider bridge disables built-in execution tools and uses Pi-served tools; its carried patch adds only WebSearch/WebFetch in unrestricted turns. These changes are primarily relevant to user configuration and other bridge execution paths, not a reason to enable native Bash. [U5, U8, U4, R3]
- Resume/fork fixes cover empty replies, compaction boundaries and queued prompts; MCP fixes cover removed servers, startup hooks, denial rules, reconnects and retention. 0.3.329 releases idle tool-result memory and reduces replay-message retention. These directly merit bridge resume, cancellation and tool-routing checks. Rewind can now refuse queued commands rather than removing the wrong history. [U5–U7, U9, U11]
- Other opt-in changes include subagent waiting when `CLAUDE_CODE_FORK_SUBAGENT=0`, corrected inline-agent precedence, policy refresh behavior on Windows/macOS, and corrected fast-mode selection/billing for Google Cloud Agent Platform. Do not infer these are active in the default Linux bridge. [U8–U10]

Registry metadata contains 0.3.324, but the queried upstream releases list supplied no separate release entry for it; endpoint tarball comparison covers its cumulative output, not an invented release note. [U1, U12]

### Supply chain and licence

The candidate was published **2026-11-20 19:18:50.922 UTC**, approximately 65 hours before this inspection. The wrapper and both glibc Linux package registries identified 0.3.330 as `latest` and `next`, with no deprecation field; no superseding stable version was observed. Maintainer arrays and repository metadata are unchanged between the two inspected versions (platform packages have no repository field in either). [U1–U3]

All six downloaded tarballs matched registry SHA-512 integrity. Both advertised registry signatures on each version/package verified using Node's crypto verifier and npm's current key endpoint, over `name@version:integrity`. All used key ID `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. The four native binaries also matched the wrapper manifests' SHA-256 checksums. **None of these six version records advertised `dist.attestations`: npm provenance was not available to verify.** Registry signatures establish registry integrity, not a verified source/build provenance chain. [U1–U3, U13]

There is no observed package-level licence declaration change: wrapper `SEE LICENSE IN README.md`, native packages `SEE LICENSE IN LICENSE.md`. The wrapper README's only textual change is the `/core` capability paragraph; its references to commercial terms and privacy remain. The native licence still references Anthropic's legal agreements. This is not an MIT-licensed bundle. Current upstream guidance permits hosting the unmodified binary subject to its terms and user-owned authentication, and distinguishes that from intermediating subscription credentials; this report is not legal clearance. [U1–U3, U14]

**Bundled-dependency limitation:** unchanged npm peers do not prove unchanged libraries compiled into the native executable or inlined into SDK bundles. Neither platform tarball supplies a standalone complete third-party inventory. The old wrapper contains a mime-types MIT notice comment that the new `.mjs` files no longer contain; this alone does not establish whether the library was removed or a notice was lost. No complete embedded dependency/licence equivalence was established. Retain upstream files and review the resulting notice closure; do not label everything MIT or claim the npm graph audits the native binary's contents. The repository already treats provider terms as separate from its own licence. [U1–U3, R4]

### Both archive targets

Measured npm tarball and registry unpacked sizes, in bytes (not final core archive sizes):

| Package | Compressed 0.3.321 → 0.3.330 | Unpacked 0.3.321 → 0.3.330 |
| --- | ---: | ---: |
| SDK wrapper | 1,507,185 → 1,553,261 | 5,182,471 → 5,257,725 |
| linux-x64 glibc | 159,254,839 → 175,385,316 | 341,910,621 → 381,121,629 |
| linux-arm64 glibc | 160,278,961 → 176,189,563 | 341,501,965 → 379,971,597 |

Ubuntu targets select the glibc native executable via npm optional dependencies: amd64 maps to npm x64, arm64 to arm64. These are precompiled ELF executables, not Node ABI addons requiring node-gyp. ELF architecture/interpreter remain appropriate for each target; the highest imported GLIBC version observed by `readelf --version-info` remains 2.26 on both. No new OS requirement was identified from metadata/ELF inspection; neither native execution nor a full Ubuntu build was performed. [U2, U3, R1, R4]

With one correctly aligned SDK graph, this adds roughly 39.3 MB expanded on amd64 or 38.5 MB on arm64 including the wrapper. The naive dual-version graph instead retains the old SDK/native copy as well. Build each core on a native host of its target; npm install scripts remain disabled. The npm registry tarballs provide the per-target bytes; the SDK's additional download manifests are not a reason to substitute an unlocked binary. Final archive size and file counts must come from the rebuilt closure. [R1, R4]

## 2. Required product work and proof for a bump

1. **Resolve the actual consumer first.** Align the bridge dependency through a reviewed bridge update or explicit override; reproduce the same selection in `internal/daemon/pi-device-test/package.json` and its lock. Confirm resolution from the installed bridge directory, not just `npm ls` at the root. Add an assertion that the bridge resolves the intended SDK: today's `validCoreRuntime` accepts any matching suffix/version component and can accept the new root alongside an old nested consumer. [R1, R2, R5]
2. Regenerate `runtime/core/package-lock.json` with scripts disabled, inspecting all platform variants, integrity fields, peer changes and duplicate SDK paths. Update the SDK entry in `internal/host/release_closure_linux.go` and its fixture in `release_closure_linux_test.go`. A bridge version change also updates its accepted version and requires its own review. [R1, R2]
3. **Do not churn unrelated locks.** `runtime/core/artifact-lock.json` pins Node and Rust tools, not this npm package: no input SHA-256 changes there for an SDK-only change. Taskfleet/workmux Cargo and crate-licence records, browser lock, optional profile locks and `web/package-lock.json` do not need regeneration for this SDK alone. Rebuilding core does regenerate output file/component hashes, retained notices, archive SHA-256/size and `artifact.json`; a new release manifest must name those new bytes. [R1, R4]
4. Carry `runtime/core/bridge-patch.json` unchanged unless deliberately replaced. Its old text matched the inspected 0.12.0 bridge exactly once. It preserves native web tools only for unrestricted turns; an SDK bump must not bypass the Pi approval hook. A bridge update can move this patch point and must be checked separately. [R3]
5. Run focused checks after alignment: `python3 scripts/test-profile-runtime-build.py`; host `TestReleaseClosure`, `TestReleasePlatformPackages`, `TestReleaseExecutableArchitecture`, and `TestReleaseNPMLockCPU`; daemon fixture `bridge-tools.test.mjs`, `turn-modes.test.mjs`, `models.test.mjs`, and `claude-default.test.mjs` using the **candidate-resolving** fixture lock. The bridge-tools fixture substitutes Claude Code, so it proves SDK/bridge protocol and Pi gating, not the real candidate engine. Add a synthetic native-candidate smoke for startup, MCP call/result, cancellation and resume, with no real credentials. [R4, R5]
6. Build `scripts/build-core-runtime.sh --target TARGET NEW_OUTPUT` on each native target and run `OH_CORE_ARTIFACT_DIR=OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore`. Verify manifest construction with required integrations as documented. This proves archive closure/architecture, not model service entitlement or installed distinct-UID isolation. Full release qualification remains the release owner's step. [R4]

## 3. Product features touched

- Claude-backed Pi conversations, streaming and tool execution: `runtime/core/agent-bin/pi`, `internal/daemon/pi_device_linux.go`, upstream bridge `src/index.ts`, `src/query-process.ts`, and the SDK subprocess/MCP transport. [R1, U4]
- Provider-native search/fetch and text-only/per-call-approval enforcement: `scripts/core-runtime-build.py::patch_bridge`, `runtime/core/bridge-patch.json`, `internal/daemon/process-extension.mjs`, and `pi-device-test/bridge-tools.test.mjs`. [R3, R5]
- Conversation continuity and native transcript reconciliation: bridge session synchronization and `internal/daemon/process-extension.mjs`'s Claude transcript/session-registry handling. The range's resume/fork fixes matter here. [U4, U6, U11, R5]
- Claude model discovery/defaults, model observations, background generation and icon/title paths: `internal/daemon/model_observations_linux.go`, `workspace_icon_suggest_linux.go`, `title_bridge_linux_test.go`, and the recap/model fixture tests. These use the bridge rather than making the browser a direct SDK client. [R5]
- Runtime acceptance and install/upgrade payload size: `internal/host/release_closure_linux.go` and core archive generation. No browser wire-schema change is implied. [R2, R4]

## 4. New capabilities — separate proposals, not bump scope

- **Explain ignored native settings/hooks.** New informational warning codes distinguish invalid settings, unloaded managed hooks, incomplete hook verdicts and newly arriving managed MCP policy. A future bridge could forward bounded, sanitized diagnostics through daemon events to the conversation UI. This requires explicit mapping and privacy review; raw configuration paths/messages must not be blindly published. [U5, U6, U9, U10]
- **Move explicit external MCP configuration off argv.** `mcpServersDelivery: 'initialize'` is now available; `'argv'` remains the default and is deprecated. Adopt in the bridge only with a supported Claude executable and tests of initialization failure/custom executable behavior. In-process SDK MCP servers are unaffected, so this is not an automatic improvement to Pi's served-tool path. [U6, U1]
- **Native Claude session archive metadata.** `archiveSession`, `unarchiveSession`, and `archived` listing fields could support native-session housekeeping. Do not substitute this for Pi conversation archive semantics: a product design must establish which native history is being changed without creating a second registry. [U5, U1]
- **Better policy diagnostics.** `resolveSettings().machinePolicy.didNotLoad` and alpha `matchDeniedModels` can explain unavailable models/settings. Any display must remain advisory: the matcher explicitly does not grant permission or replace Claude's enforcement. [U11, U1]

## 5. Verdict and evidence limits

**Needs-work**, specifically dependency alignment and verification of the actual bridge consumer. There is no observed yank, superseding stable release, signature failure, changed declared licence or platform incompatibility requiring a `hold`. There are upstream behavior changes and incomplete embedded-licence evidence, but no demonstrated product regression. A root-only mechanical bump cannot deliver the intended runtime change and may substantially inflate both archives. [U1–U3, R1, R2]

Performed: registry/release inspection; six tarball integrity and registry-signature checks; native manifest checksum checks; file/type/README/licence comparisons; ELF inspection; disposable npm lock regeneration; source inspection and patch match check. Not performed: full bundled-source/licence audit, native candidate execution, either core build, provider turns or the implementation checks listed above. This research did not modify pins, locks, contracts or issue metadata. Documentation validation passed with `python3 scripts/validate-project-view.py`; `git diff --check` passed (repeated against the staged report before commit).

## Sources

Upstream sources retrieved 2026-11-23; tarball contents referenced above are the `dist.tarball` artifacts from these registry records.

- **U1:** https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk — versions 0.3.321 and 0.3.330, publication times, signatures, peers, manifests, SDK declarations/bundles and README.
- **U2:** https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-x64 — same versions and tarballs.
- **U3:** https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-arm64 — same versions and tarballs.
- **U4:** https://registry.npmjs.org/pi-claude-bridge/-/pi-claude-bridge-0.12.0.tgz — package.json and provider source.
- **U5:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.325
- **U6:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.326
- **U7:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.327
- **U8:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.328
- **U9:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.329
- **U10:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.330
- **U11:** https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.323
- **U12:** https://api.github.com/repos/anthropics/claude-agent-sdk-typescript/releases?per_page=20 — release enumeration; 0.3.322 notes state Claude Code parity only.
- **U13:** https://registry.npmjs.org/-/npm/v1/keys — registry signature verification keys.
- **U14:** https://code.claude.com/docs/en/legal-and-compliance — current upstream hosting, authentication and terms guidance; not a historical legal-text comparison.

Repository sources at the assessed commit:

- **R1:** `runtime/core/{package.json,package-lock.json,artifact-lock.json,AGENTS.md}`, `internal/daemon/pi-device-test/{package.json,package-lock.json}`.
- **R2:** `internal/host/release_closure_linux.go::validCoreRuntime`, `internal/host/release_closure_linux_test.go`.
- **R3:** `runtime/core/bridge-patch.json`, `scripts/core-runtime-build.py::patch_bridge`, `scripts/AGENTS.md` (Carried patches).
- **R4:** `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, `runtime/profiles/AGENTS.md`, `TESTING.md`, `docs/operations.md` (Build and verify runtime archives).
- **R5:** `internal/daemon/process-extension.mjs`, `pi_device_linux.go`, `model_observations_linux.go`, `workspace_icon_suggest_linux.go`, `title_bridge_linux_test.go`, and `internal/daemon/pi-device-test/*test.mjs` named above.
