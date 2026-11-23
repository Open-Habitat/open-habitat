Verdict: safe-to-bump

# workmux 0.1.278 → 0.1.284

Assessed 2026-11-23 against product commit `fefaf23dd`. This is a mechanical runtime update, **not** approval to adopt new backends, agents or orchestration semantics. The existing Taskfleet invocation remains compatible. Build and closure qualification below still belongs to the bump; this research did not build complete runtime archives.

## 1. Installability and upstream changes

### Release and compatibility

GitHub's latest-release endpoint returned `v0.1.284`, published **2026-11-21 15:06:56 UTC**, approximately two days old: neither draft nor prerelease, and not superseded at inspection. The tag resolves to `748997d6e9a6cf4d8f25035ee996f85251bd65a9`. The crates.io sparse index also contains 0.1.284, published 2026-11-21 15:08:04 UTC, with `yanked: false`. The ordinary crates.io version API returned HTTP 403; the successful sparse-index query supplies the registry evidence instead. [U1, U3]

The comparison contains 78 commits. Read the checked-in changelog as well as GitHub's generated notes: the latter omit several significant changes. Compatibility-relevant differences are:

- **0.1.279:** `send` refuses waiting/dialog agents and ambiguous worktree targets rather than guessing; adds pane-ID targeting and `--wait`. `open --background` is new. Remote relay reconnection, dashboard cross-project opening and sidebar exit handling improve.
- **0.1.280–282:** fixes `.git` files pointing to bare repositories, slow backend observations blocking state updates, detached-worktree removal, and bare-repository `{project}` expansion. Existing paths/windows are not migrated; newly expanded bare-repository names can differ. Copilot CLI and experimental Zellij sidebars are added; Zellij minimum is 0.44.1, while Copilot waiting hooks require CLI 1.0.18 or later.
- **0.1.283:** experimental Rex backend and sidebars; `add --headless --pr` including fork PRs; PR/MR informational output moves from stdout to stderr in **all** modes. Nested worktree ownership, pane handshakes, concurrent sidebar startup and cancelled Pi status are fixed. Sidebar **Quiet** is presentation of inactivity, not a successful or terminal agent status.
- **0.1.284:** `add --with-changes` uses normal creation, honors agent/prompt options and transfers changes before hooks/agents. It preserves staged versus unstaged edits and retains a stash backup. It now rejects `--base`, `--pr` and multi-worktree combinations; patch transfer requires unstaged changes and excludes `-u`. Also fixes glab prompt environment, transient sandbox listener failures, tmux sidebar reconnect/focus updates, and headless Pi/OMP helpers overwriting pane status. [U2, U4]

These are real upstream behavior changes, but none requires an Open Habitat contract migration. The pinned Taskfleet source's `crates/taskfleet/src/run/spawn.rs` calls `workmux add BRANCH -b -P PROMPT -a GENERATED_LAUNCHER`, optionally `--parent-session`, `--base`, `-l`, `--no-hooks`, then reads `workmux path BRANCH`. It does **not** use `--with-changes`, scrape PR output or send browser messages through `workmux send`. Taskfleet's `--headless` is not a promise to use workmux's mux-free `add --headless`: its native materializer still uses tmux. [U5; P3]

### Runtime and licences

Workmux is a Rust executable, not an npm package. There is no Node engine constraint or native Node module to rebuild against the product's **Node 22.21.1** artifact pin. Cargo edition remains 2024; upstream declares no root `rust-version`. Newly added `kdl 6.7.1` declares Rust **1.95** for source compilation, which does not require installing Rust in the distributed runtime. Git and the selected multiplexer remain external runtime commands. New Rex/Zellij/Copilot capabilities do not make those tools required for Habitat's existing tmux/Pi path. [U4, U6; P1]

The top-level MIT LICENSE is byte-identical to the existing locked LICENSE. Cargo.lock retains all **356** previous registry packages and adds six, with no existing registry version/checksum removed or replaced:

| Added crate | SPDX declaration |
| --- | --- |
| kdl 4.7.1, 6.7.1 | Apache-2.0 |
| miette 5.10.0, 7.6.0 | Apache-2.0 |
| miette-derive 5.10.0 | Apache-2.0 |
| unicode-width 0.1.14 | MIT OR Apache-2.0 |

These form the KDL parsing/diagnostics dependency chain for Zellij layouts, not an unexplained network or installation dependency. All six crate archives were downloaded, checked against Cargo.lock checksums and inspected for their own Cargo.toml declarations; all pass the product's `licence_allowed` predicate. The existing git-pinned crossterm fork remains at `f99eeae405e28fa8cb353a6c6e36c493e72891bd`, MIT. Unchanged dependencies were compared to the existing product lock, not independently re-audited for vulnerabilities. [U4, U7; P1, P2]

### Supply chain and target artifacts

Repository identity remains `raine/workmux`; the package repository/author declarations and release workflow do not change in this range. Release author matches the prior release. This is evidence of continuity, not proof that maintainer credentials have never changed. GitHub reports `immutable: false`. The workflow builds with `--locked`, but uses mutable action tags and the moving stable Rust toolchain. It uploads archives/checksum files and publishes Cargo with a token; it has no attestation-generation step. No provenance attestation or signature was verified. **npm registry signatures/provenance are inapplicable** to the shipped distribution; checksum agreement is integrity evidence, not independent build provenance. [U1, U4, U6]

Both official Linux downloads exist, contain the `workmux` executable, and match **both** GitHub asset digests and published `.sha256` sidecars:

| Target | Compressed bytes (old → new) | New executable bytes | SHA-256 of new archive |
| --- | --- | --- | --- |
| linux-amd64 | 7,352,247 → 7,735,652 (+383,405) | 18,623,792 | `71107f9dad181ba2bfff6367cbd396295599efaf29ece704b3ea34788a2603c9` |
| linux-arm64 | 6,688,447 → 7,057,628 (+369,181) | 15,403,776 | `2728b0deea1f019aeabb496935210c82418b760bdec6df9d3db8934d640c0822` |

ELF inspection found x86-64 static PIE and aarch64 statically linked executables, consistent with the unchanged musl release matrix. No new dynamic glibc/Node ABI requirement or per-install platform downloader is introduced. Habitat extracts the pinned executable and inventories licences; it does not run upstream shell installers, npm lifecycle scripts or Cargo build scripts. The compressed changes above are upstream-download deltas, **not** measured final core-archive growth: generated licence inventory also grows. [U1, U6; P2]

## 2. What the bump must change and prove

Only this research file is changed by this run. A later bump should:

1. Generate the workmux record with `scripts/rust-tool-lock.py workmux raine/workmux v0.1.284 workmux-linux-amd64.tar.gz workmux-linux-arm64.tar.gz workmux`, then replace only that entry in `runtime/core/artifact-lock.json`. Regenerate commit-qualified LICENSE/Cargo.lock digests and all 362 registry-crate records plus the existing git-crate record; do not merely replace binary URLs. The candidate Cargo.lock SHA-256 observed here is `3c49caf6763677fb9cf9a1bc6f1545f7bba1d1ab823932a3327f2e89b7423126`.
2. Raise workmux in `internal/host/release_closure_linux.go`'s `CoreAgentTools` and the corresponding fixture map in `release_closure_linux_test.go`. Update the explicit operator-guide version in `docs/operations.md`.
3. Rebuild core on **each native target** with `scripts/build-core-runtime.sh --target linux-amd64|linux-arm64 NEW_OUTPUT`. The builder regenerates `licenses/workmux/`, crate manifests/notices, binary/file/component inventories and `artifact.json`; release publication must use fresh core archives/descriptors and manifest digests. Taskfleet's generated skills remain owned by its unchanged pin.
4. Leave npm `package.json`/`package-lock.json`, daemon Pi fixture locks, browser locks, web lock and Ubuntu requirements unchanged. There is no carried workmux source patch: `rust-tools-runtime.py` extracts upstream bytes directly. The separate `bridge-patch.json` patch is unrelated and must remain intact. [P1, P2, P4]

Focused qualification for that change:

- `python3 scripts/test-profile-runtime-build.py` for target/lock invariants.
- Affected host tests, especially `TestReleaseClosureCoreAgentTools`, `TestReleaseCoreAgentToolsObserved` and the remaining `TestReleaseClosure` cases; use the focused Go runner's prerequisite setup where needed.
- For **both** fresh core builds, `OH_CORE_ARTIFACT_DIR=BUILD_OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore`; generate and verify the actual release manifest with `runtime-release` and the matching integrations closure.
- Disposable native Taskfleet create/cancel against the built payload on each target, with isolated HOME/config/state/repository and private tmux; test Pi launcher/skill discovery as described in `TESTING.md`. Include creation from a normal repository and a bare-repository layout if that installation supports it. Neither unit tests nor this same-UID smoke proves mapped-user isolation or browser Workers acceptance. [P4]

**Research evidence:** both archive hashes/ELF architectures and six added crate declarations verified; candidate arm64 `--version` returned `workmux 0.1.284`. On native arm64, a synthetic private-tmux fixture successfully ran the Taskfleet-shaped `add` with background, prompt file, custom inert agent, parent session, explicit base and no hooks, then `path` and `remove --force`. The fixture's server was stopped afterward. The attempted amd64 execution was rejected on the arm64 host and supplies **no** amd64 execution evidence. No full upstream test suite, native amd64 run, complete core build or end-to-end Taskfleet/Pi worker was run here. Report validation: `python3 scripts/validate-project-view.py` passed (13 pages), and `git diff --check` passed.

## 3. Product features affected

- **Available agent commands and delegation:** `internal/daemon/agent_path_linux.go`, `runtime/core/taskfleet-skills.mjs`, and `scripts/core-runtime-build.py` supply the core tools and skills; the pinned Taskfleet materializer is the direct workmux caller. Worktree creation/path resolution is the primary exposure. [P2, P3, U5]
- **Workers and worker terminal viewing:** `internal/daemon/spinoffs_linux.go`, `internal/daemon/spinoff_activity_linux.go`, `internal/daemon/terminal_linux.go`, `web/src/app/spinoffs.ts` and `web/src/app/SpinoffConversation.tsx` depend indirectly on successfully created native workers. They consume Taskfleet/Pi/tmux state, not workmux's sidebar status protocol. No wire schema change is indicated. [P3]
- **Worktree/workspace lifecycle safeguards:** `internal/daemon/workspace_worktrees_linux.go` and `workspace_delete_linux.go` use Git/Taskfleet observations for deletion blockers. Upstream bare/nested/detached fixes are relevant native behavior, but do not replace Habitat's own lifecycle authority. [P3]
- **Runtime delivery/health:** `internal/host/release_closure_linux.go`, its tests, and `scripts/rust-tools-runtime.py` enforce the exact tool version, architecture and licence/file closure. [P1, P2]

## 4. New capabilities — separate proposals only

1. **PR-to-worker provisioning:** headless PR/fork resolution could support a future “review this PR” entry point. It needs explicit product/Taskfleet ownership of base/ref selection, authentication, repository trust, safe JSON/error handling and cleanup tests. Do not silently substitute workmux headless provisioning for the current launcher transaction. [U2, U4, U5]
2. **Additional native terminal backends:** Rex and Zellij sidebars are available upstream, but Habitat's terminal attachment and Taskfleet integration are tmux-specific. Supporting them requires a deliberate backend/attachment design, dependencies and isolation/lifecycle tests; the pin alone does not enable them. [U2; P3]
3. **Copilot workers:** upstream built-in agent/hooks could help a future agent integration, but Habitat would need separate harness/session, authorization, launcher and browser-conversation support. Installing Copilot or mutating personal hooks is outside this bump. [U2; P3]
4. **Safer native message dispatch and quiet presentation:** `send --wait` and Quiet may inform future UX, but Taskfleet message delivery and Pi conversation events remain authoritative. Any browser use would need explicit waiting-dialog/ambiguous-target/error mapping; inactivity must never become completion. No change is needed merely to ship the binary. [U2, U4; P3]

## 5. Verdict rationale

**Safe to bump**, subject to the normal focused build/runtime checks: official artifacts exist for both targets; new dependencies have compatible licence choices; no Node/ABI migration or product-call adaptation was found; a representative native arm64 materialization succeeds. The release is young and its GitHub assets are not immutable or independently provenance-verified, so retain digest locking and rerun the checks on the exact fetched bytes. No observed regression or new supply-chain blocker justifies holding this candidate. Optional capabilities remain separate work.

## Sources

Upstream primary sources (queried 2026-11-23):

- **U1 — GitHub release metadata:** `https://api.github.com/repos/raine/workmux/releases/tags/v0.1.284`, `https://api.github.com/repos/raine/workmux/releases/tags/v0.1.278`, `https://api.github.com/repos/raine/workmux/releases/latest`; release page `https://github.com/raine/workmux/releases/tag/v0.1.284`. Archive names and checksum sidecars are under that release's `/releases/download/v0.1.284/` path.
- **U2 — Complete release notes:** `https://github.com/raine/workmux/blob/748997d6e9a6cf4d8f25035ee996f85251bd65a9/CHANGELOG.md`, entries 0.1.279–0.1.284.
- **U3 — Registry index:** `https://index.crates.io/wo/rk/workmux`, entry 0.1.284; crate checksum `76f2abb607c2c97094acbae188887cb31f444d101b01088007c737d70f86d364` (registry metadata, not the binary archive checksum).
- **U4 — Full comparison:** `https://api.github.com/repos/raine/workmux/compare/v0.1.278...v0.1.284`; notably `Cargo.toml`, `Cargo.lock`, `src/command/add.rs`, `src/command/send.rs`, `src/workflow/create.rs`, `src/workflow/pr.rs`, `src/gitlab.rs`, and `src/multiplexer/zellij.rs`.
- **U5 — Pinned Taskfleet caller:** `https://github.com/jarimustonen/taskfleet/blob/6ad8d7ca22246804c6c79f038e57bba4c45acee5/crates/taskfleet/src/run/spawn.rs`, native materializer and command environment.
- **U6 — Release construction:** `https://github.com/raine/workmux/blob/748997d6e9a6cf4d8f25035ee996f85251bd65a9/.github/workflows/release.yml`; `Cargo.toml` and `LICENSE` at the same commit.
- **U7 — Published dependency declarations:** `https://static.crates.io/crates/NAME/NAME-VERSION.crate` for the six table entries, digest-checked against U4 and inspected directly, rather than inferred from project descriptions.

Repository primary sources at the assessed revision:

- **P1:** `runtime/core/artifact-lock.json`; `internal/host/release_closure_linux.go`; `internal/host/release_closure_linux_test.go`.
- **P2:** `scripts/rust-tool-lock.py`; `scripts/rust-tools-runtime.py`; `scripts/core-runtime-build.py`; `runtime/core/AGENTS.md`.
- **P3:** product paths named in section 3 and `runtime/core/taskfleet-skills.mjs`.
- **P4:** `TESTING.md`, especially core runtime qualification; `docs/operations.md`, “Build and verify runtime archives”; `runtime/profiles/AGENTS.md`.
