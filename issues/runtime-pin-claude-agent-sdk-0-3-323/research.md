Verdict: safe-to-bump

# Claude Agent SDK 0.3.321 → 0.3.323

Assessed 2026-11-13, against repository commit `4ce5ee0a`. This is a mechanical runtime update, including the verifier's expected version, not a claim that upstream behavior is unchanged. No required Open Habitat API or authority change was identified. The build and focused checks below remain conditions of landing the actual bump; this research does not change or qualify a runtime archive.

## 1. Installability, compatibility and supply chain

**Published and current.** The npm registry reported `latest` and `next` as 0.3.323, published 2026-11-12 at 20:33:59 UTC (about 19 hours old at inspection). Neither endpoint version was marked deprecated. The intermediate 0.3.322 was published November 10. The SDK embeds Claude Code compatibility versions 2.1.321 → 2.1.323. [S1]

**Requirements.** Both SDK versions require Node `>=18.14.0`; the actual core archive pin is **22.21.1**, not the newer development-test Node mentioned in TESTING.md. Exports, ESM entry points and peer ranges are unchanged: `zod ^4.0.0`, `@anthropic-ai/sdk >=0.93.0`, `@modelcontextprotocol/sdk ^1.29.0`. The current core lock's 4.6.7, 0.129.0 and 1.32.1 satisfy them. No new direct dependencies, lifecycle install scripts or platform families appeared. Eight optional native package versions advance together. [S1, S4; `runtime/core/{package-lock,artifact-lock}.json`]

**Diff and behavioral changes.** Downloaded and compared both SDK tarballs, including their declarations and README. No removed public root export was identified; `/core` adds `matchDeniedModels`. The root package grows from 21 to 30 files, mostly additional split `core-*.mjs` chunks; its extractor and bridge/browser declarations are unchanged. The upstream SDK changelog explicitly identifies: [S2, S4]

- New hook-wait `tool_progress` heartbeats, with hook names and `hook-` IDs that need not correspond to an existing tool call.
- MCP progress/reconnect fixes, session-fork/compaction and queued-message fixes, and initialization options now respected when a SessionStart hook supplies the first prompt.
- More `init.plugin_errors`, including managed-plugin load errors before background installation completes; synchronous plugin installation remains an opt-in.
- Assistant `supersedes` now also covers malformed tool-call responses, not just refusal fallbacks.
- Permission-check errors after a PreToolUse allow now reach `canUseTool`, or deny without a callback. Sensitive-path Bash allow suggestions are corrected.

The bundled Claude Code changelog is substantially larger than the SDK list. It includes permission/sandbox fixes, invalid sandbox settings failing startup instead of silently running unsandboxed, sandbox worktree-write restrictions, and removal of the old MCP v1 client (the selector now chooses v2 compatibility mode). Marketplace policy semantics also tighten: a scope wildcard in an npm marketplace policy no longer matches packages. These matter to native user configurations; they are not grounds to promise identical behavior. Open Habitat neither implements these policies nor sets that MCP compatibility selector. The pinned bridge loads user settings, so custom settings may expose the stricter refusals. Do not weaken them to make a test pass. [S3, S4, S7]

The pinned bridge's provider `queryOptions` use `bypassPermissions`, user-only setting sources, Pi's supplied MCP tools and, after the carried patch, only WebSearch/WebFetch as Claude built-ins. Its `consumeQuery` dispatch accepts known message kinds without requiring every SDK progress frame to become a Pi tool call. Thus the additional heartbeat is not a new browser-contract requirement. SDK-only policy helpers and plugin interfaces are not product APIs. The broader `supersedes` behavior warrants a bridge streaming regression check, but it is an extension of an existing upstream message field, not a newly required API migration. [S7; `scripts/core-runtime-build.py`]

**Registry authentication.** SHA-512 integrity verified for all six downloaded packages: old/new root SDK and old/new glibc Linux x64/arm64 packages. Both registry signatures on each package verified using Node crypto against npm's published registry key (`SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`). Maintainer lists, repository URL and trusted GitHub publisher configuration are unchanged between root versions. None of these six registry records exposes `dist.attestations`: **no provenance attestation was available to verify**. Trusted-publisher metadata is not a substitute for source-to-artifact provenance. Signatures authenticate the registry's version/integrity binding, not the safety of the executable. [S1, S5, S6]

**Licences.** The root licence remains `SEE LICENSE IN README.md`; its only README diff describes the new matcher, not terms. Native packages remain `SEE LICENSE IN LICENSE.md`; all four downloaded native LICENSE.md files are byte-identical (SHA-256 `8ce94b9478bb9868f9641f818e06cd722fbe55d4c22e2d2ed11971b20146173a`). They reserve Anthropic's rights and refer to its legal agreements; this is not MIT simply because the runtime wrapper is MIT. No separately packaged new dependency or licence change was found. Root bundles inline dependencies and native packages contain an opaque compiled `claude`; their tarballs do not supply a complete independently auditable bundled dependency/licence inventory. Consequently this is evidence of unchanged supplied terms, **not** a legal audit of every internal dependency or of mutable linked legal terms. Preserve all supplied notices/README/licence files in the regenerated archive. [S1, S4, S5; `docs/operations.md`, `scripts/core-runtime-build.py`]

**Both targets.** Ubuntu selects the glibc native package by npm OS/CPU/libc constraints; linux-amd64 uses `linux-x64`, linux-arm64 uses `linux-arm64`. Each native tarball has four files: compiled `claude`, package.json, LICENSE.md and README.md. There is no node-gyp build or install-script download. Native execution still needs target-architecture qualification; metadata and integrity do not prove execution. The existing musl alternatives are not a new requirement. [S5]

| Package | Download bytes, old → new | Unpacked bytes, old → new |
| --- | ---: | ---: |
| SDK root | 1,507,185 → 1,549,698 | 5,182,471 → 5,308,633 |
| Linux x64/glibc | 159,254,839 → 167,493,942 | 341,910,621 → 362,435,677 |
| Linux arm64/glibc | 160,278,961 → 168,540,565 | 341,501,965 → 362,211,341 |

Downloads were measured; unpacked sizes are registry values. Budget roughly 20.7 MB extra uncompressed SDK-plus-native payload per target. This is not a measurement of the final compressed core archive, which must be rebuilt. [S1, S5]

## 2. Bump obligations and focused proof

- Raise the direct SDK pin in `runtime/core/package.json`; regenerate `runtime/core/package-lock.json`, retaining exact optional packages and integrity records for both architectures. Avoid unrelated peer upgrades. Refresh the SDK closure in `internal/daemon/pi-device-test/package-lock.json` too: it currently resolves 0.3.321 through the bridge, so leaving it unchanged tests the wrong SDK.
- Update the expected SDK version in `internal/host/release_closure_linux.go` and its fixture in `internal/host/release_closure_linux_test.go`. This is a packaging acceptance constant, not an application behavior change.
- **No SDK SHA-256 entry exists in `runtime/core/artifact-lock.json`**: it contains Node and Rust tools, not npm tarballs. Leave those pins, Rust Cargo/licence records and `CoreAgentTools` unchanged. npm uses its package-lock integrity records. Rebuilding regenerates archive SHA-256, component/file digests and licence membership in artifact/release records.
- No browser lock, Playwright revision, web lock or integration-profile dependency changes follow from this SDK update. Keep `runtime/core/browser-lock.json` and Rust-tool notices intact. Retain upstream npm licence/notice files through the builder; do not relabel the SDK as MIT.
- Carry `BRIDGE_PATCH` in `scripts/core-runtime-build.py` unchanged. It patches bridge 0.12.0 exactly once to enable WebSearch/WebFetch. This is not an SDK source patch; the SDK update does not resolve the upstream bridge feature request. The downloaded bridge source still matches the patch anchor.

Sources: `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, the files above, `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, TESTING.md and the development-runtime build section of `docs/operations.md`.

For the bump worker:

1. Run clean, script-disabled npm installation using the regenerated lock and the pinned Node; check that only the intended SDK/native closure changed and repeat registry verification for newly resolved bytes.
2. Run `python3 scripts/test-profile-runtime-build.py` and focused host closure/architecture tests (`TestReleaseClosure`, `TestReleasePlatformPackages`, `TestReleaseExecutableArchitecture`, `TestReleaseNPMLockCPU`). Use the repository's focused Go runner so its Python prerequisites are present.
3. Build core with `scripts/build-core-runtime.sh --target linux-amd64 NEW_OUTPUT` and separately `--target linux-arm64 NEW_OUTPUT` on native target builders. Run `OH_CORE_ARTIFACT_DIR=<output> go test ./internal/host -run TestReleaseClosureBuiltCore` for each build. Verify the generated manifest against its exact archives. These checks prove inventory, architecture, lock/notice retention and the bridge patch, not provider entitlement.
4. Run focused daemon tests using the refreshed fixture for Claude login/model catalog and background recap/icon paths. Exercise a built-runtime bridge turn with MCP tool execution, WebSearch/WebFetch, cancellation and session continuation; include a long-running hook and malformed-tool-response replacement if a synthetic bridge fixture can produce them. Existing real-Pi controller tests alone do not prove live Claude behavior. A credentialed provider smoke remains separate from networkless tests and must use a synthetic conversation, not real histories.

## 3. Product features touched

- Claude-subscription chat, streaming, native tool handoff and web search: `runtime/core/agent-bin/pi`, the packaged `pi-claude-bridge/src/index.ts`, `scripts/core-runtime-build.py`, and `runtime/core/web-search.mjs` (Claude uses the bridge's built-ins rather than that extension's other-provider requests).
- Claude connection/login and model discovery: `internal/daemon/claude_login_linux.go`, `pi_device_linux.go`, `pi_models_helper.mjs` and `model_observations_linux.go`.
- Background model work: `internal/daemon/recap_linux.go`, `icon-helper.mjs`, and `workspace_icon_suggest_linux.go` load/register the bridge. Model failures or changed startup behavior can therefore affect recaps and suggested icons as well as foreground chat.
- Runtime release acceptance: `internal/host/release_closure_linux.go` rejects the new SDK until its exact accepted version advances.

No browser schema, gateway authentication or Unix-user security authority moves with this bump. [Repository paths above; S7]

## 4. New capabilities — separate proposals, not bump scope

- **Explain model-policy refusals:** alpha `matchDeniedModels` and `resolveSettings().machinePolicy.didNotLoad` could improve per-user model diagnostics. The daemon/bridge would need to expose bounded diagnostics and the UI would need explanatory states. Never treat a false matcher result as authorization; its documented contract explicitly does not promise CLI acceptance. No new central policy store is needed. [S2, S4]
- **Show hook waits accurately:** the bridge could translate the new heartbeat into activity text without fabricating a tool call or assuming `parent_tool_use_id` exists. Requires upstream bridge mapping and product event/rendering tests if surfaced beyond existing Pi events. [S2]
- **Control subagent-summary cost:** the new `CLAUDE_CODE_DISABLE_AGENT_PROGRESS_SUMMARIES=1` override could be surfaced if the product later offers these summaries. It is a disable control for an existing opt-in capability, not evidence summaries are enabled today. Any setting needs clear ownership and environment propagation through the bridge. [S2, S4]

These are optional conductor proposals; none is required for the pin change.

## 5. Evidence limits and recommendation

Proceed with the mechanical bump and focused qualification above. The candidate is young, but remains current, has verified registry signatures and matching tarball integrity, unchanged declared requirements/terms, and includes useful permission and session fixes. No observed regression or new product decision justifies holding it. This is not a claim that proprietary native internals, live account behavior or all user-supplied settings were tested.

Research performed: registry/version/dependency comparison; six tarball integrity checks and twelve signature checks; root file/declaration/README diff; both targets' file lists, licence comparisons and byte counts; upstream changelog and bridge-source inspection; repository integration/lock/verifier inspection. No runtime archive build, native executable run, provider session or npm installation was performed. Report-only validation: `python3 scripts/validate-project-view.py` and `git diff --check`.

## Sources

- **S1 — npm full registry metadata:** <https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk> (version records 0.3.321–0.3.323 and publication times, observed 2026-11-13).
- **S2 — SDK changelog:** <https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>, sections 0.3.322 and 0.3.323 (observed 2026-11-13).
- **S3 — bundled Claude Code changelog:** <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>, sections 2.1.322 and 2.1.323 (observed 2026-11-13).
- **S4 — published root artifacts:** <https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.321.tgz> and <https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.323.tgz>. Comparison includes package.json, README.md, sdk.d.ts, core.d.ts, sdk-tools.d.ts and archive inventories.
- **S5 — native package records:** <https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk-linux-x64/0.3.321>, <https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk-linux-x64/0.3.323>, <https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk-linux-arm64/0.3.321>, <https://registry.npmjs.org/@anthropic-ai%2fclaude-agent-sdk-linux-arm64/0.3.323>; downloaded each record's `dist.tarball` and checked its SHA-512.
- **S6 — npm signature keys:** <https://registry.npmjs.org/-/npm/v1/keys>. Verified ECDSA SHA-256 signatures over `name@version:dist.integrity` against the matching SPKI key.
- **S7 — pinned bridge source:** <https://registry.npmjs.org/pi-claude-bridge/-/pi-claude-bridge-0.12.0.tgz>, `src/index.ts` query construction and consumeQuery dispatch, with Open Habitat's explicit build-time patch described above.
