Verdict: safe-to-bump

# glab 1.130.0 → 1.132.0

Assessed 2026-11-24 against product commit `395d06953a5c9f91b92f9ac84641fb4050c068c3`. This is a mechanical integrations-runtime update, including notices and verifier pins, not permission to enable new services. The existing PAT/config-file integration needs no adaptation: the real 1.132.0 arm64 binary passed both shipped-glab interoperability tests. Full runtime builds and amd64 execution remain bump-time checks.

## 1. Installability and upstream changes

**Release state.** The official releases API listed 1.132.0 first, published at `2026-11-24T12:24:17.916Z`; 1.131.0 was published November 17 and 1.130.0 November 10. The candidate was only about two hours old when research began. It was available, not superseded in that listing; this is limited early-life evidence, not a claim of production soak. Both official Linux archives and the source archive downloaded successfully. [U1–U3]

**Runtime requirements.** This is a native Go executable, not an npm package. The candidate binaries embed Go 1.27.4, versus 1.27.3 in the old binaries; both source `go.mod` files require Go 1.27.0. Both Linux binaries are statically linked ELF executables of the correct architecture; upstream builds with `CGO_ENABLED=0`. No Node engine requirement, npm native module, host Go installation, or libc upgrade is introduced by installing these binaries. The product's actual core Node lock is **22.23.5**; it need not change. Node remains relevant to building the rest of the integrations archive, not to glab execution. [U4, U5; `runtime/core/artifact-lock.json`]

**Breaking and observable changes.** Review covered both intervening release notes, the source-tree difference list, module/build inputs, and the config/auth boundary in particular:

- 1.131.0 removes the experimental `glab mcp` command. This breaks anyone's explicit use of that command, but no product runtime configuration or GitLab adapter invokes it. Open Habitat's GitLab integration uses its own native adapter, not glab MCP. Do not add a compatibility shim as part of this bump.
- `token rotate --self` now persists the rotated credential. That fits the product's existing design of rereading the native store rather than caching a second token.
- OAuth client-ID validation changes do not widen Habitat's support: OAuth and keyring entries remain glab-only. The global config read/write/lock implementation differs only in a comment; new schema keys are global Minder settings, not a new per-host credential layout.
- Local config is skipped when `git rev-parse` fails; custom HTTP header names are canonicalized; self-managed hostnames retain `www.`. Habitat does not consume local glab config or execute custom header commands. Its supported PAT model is unchanged.
- API clients can send `GITLAB_ORGANIZATION_ID` as a validated header and recognize more coding-agent environments in their user agent. These affect direct glab invocations, not Habitat's own HTTP client; no new product organization-routing contract is implied.
- Useful fixes include HTTP debug-response token redaction, dropping special permission bits during job-artifact extraction, and suppressing upgrade banners in CI/non-terminal stderr. [U2–U6; `internal/nativegitlab/logins.go`, `store_linux.go`, `client.go`; `internal/daemon/integrations/gitlab_linux.go`]

**Dependencies and licences.** The root LICENSE is byte-identical and remains MIT. The embedded dependency count falls from 145 to 140: MCP SDK, jsonschema-go, segmentio asm/encoding, and uritemplate disappear. No new module path appears in `go.mod`; go-toml becomes direct and updates from 2.2.4 to 2.4.3. Other updates include lipgloss 2.1.0, retry-go 5.1.1, Docker CLI 29.9.3, goldmark/v2 2.1.15, GitLab client-go/v3 3.52.0, autoflow 0.1.17, and Go x/* packages, including crypto 0.59.0. [U4]

The repository's `go-binary-notices.py generate` succeeded for **both** candidate binaries together. It downloaded module sources through the Go proxy/checksum database, checked release go.sum for the vendored build, and required identical embedded module lists across targets. Compared with the checked-in notices after normalizing version labels, every surviving dependency's licence text was unchanged; only the five removed dependency sections disappeared and the Go toolchain label advanced. The regenerated notices retain upstream third-party terms rather than treating the entire executable as MIT. No new licence obligation was identified by this comparison; this is not an independent audit of every upstream source file. [U4, U5; `scripts/go-binary-notices.py`; `runtime/profiles/integrations/glab-THIRD-PARTY-NOTICES`]

**Supply chain.** Official release links still resolve to the GitLab project's generic package registry. The CODEOWNERS change removes automated-bot approval authority while retaining the existing maintainer groups; no repository relocation was found. CI now explicitly gates release on unit and integration tests. The GoReleaser delta concerns announcement formatting, not Linux build/install hooks. npm registry signatures, npm provenance and lifecycle install scripts are **not applicable** to this artifact channel. The release lists checksums but no separate signature/provenance asset; no independent Linux release attestation was verified. Checksums from the same publisher detect corruption, not publisher compromise. Module checksum verification adds dependency evidence but is not release provenance. [U1, U4, U7]

Minder now has a Linux managed-binary dispatch path that can download and execute an additional agent-client on explicit command use. This is not an extraction-time install hook, and Open Habitat does not invoke it. It must not be mistaken for a separately pinned, licensed, or qualified bundled capability. [U8]

### Per-target bytes

Measured from the downloaded release archives; candidate archive hashes match upstream `checksums.txt`. Binary hashes below are separate values needed by the tool records. [U5, U7]

| Target | Old archive bytes | New archive bytes | Old executable bytes | New executable bytes |
| --- | ---: | ---: | ---: | ---: |
| linux-amd64 | 20,206,088 | 19,922,749 | 56,279,200 | 55,201,952 |
| linux-arm64 | 18,484,645 | 18,223,770 | 52,560,032 | 51,445,920 |

Both archives still expose `bin/glab`. Compressed downloads shrink by 283,339 and 260,875 bytes respectively; these are upstream archive sizes, not predictions of the final integrations archive size.

| Candidate artifact | SHA-256 |
| --- | --- |
| `glab_1.132.0_linux_amd64.tar.gz` | `24d654844cae9f8f24193219ad481a4ebf01c1dc7340ea4107ee2bedd93f9e53` |
| amd64 `bin/glab` | `c2ff19739a3f9c40ce211555d4f0a6474353d549769074c652500cbe8f43b631` |
| `glab_1.132.0_linux_arm64.tar.gz` | `f4927afddb294ca922212a9d9dc398b729f1e567f7a81a545c179dd7d38da68e` |
| arm64 `bin/glab` | `5e4509da8357a8a5ae61404b4fd60c10a4845574de7be797963a5fb61db758e5` |

## 2. Exact bump scope and proof

Change these together, for both targets:

1. `runtime/profiles/integrations/artifact-lock.json`: download filenames, URLs and archive SHA-256s; tool versions, archive names and extracted executable SHA-256s. Keep `member: bin/glab`, target selection and the Go-notices reference.
2. Regenerate `runtime/profiles/integrations/glab-THIRD-PARTY-NOTICES` using `scripts/go-binary-notices.py generate --out OUTPUT AMD64_BINARY ARM64_BINARY`. Research generation was scratch-only; commit regenerated notices in the bump, not this report.
3. Update accepted glab version in `internal/host/integrations_linux.go`, its fixture expectations in `internal/host/integrations_linux_test.go`, and both inventory/version assertions in `scripts/test-integrations-runtime.py`.
4. Rebuild integrations on native builders for each target with `scripts/build-profile-runtime.sh integrations NEW_OUTPUT --target TARGET`. Regenerate its component/file/licence records, archive and `artifact.json`; compose and verify a fresh release manifest as described in `docs/operations.md`, “Build and verify runtime archives.” Do not reuse the previous integrations archive.

There are **no carried glab source patches**: `scripts/integrations-runtime-build.py` extracts the pinned executable, verifies its digest and embedded Go notices, and inventories it. No npm package/package-lock, Go product module lock, Cargo/crate record, browser lock, generated browser contract, or core-runtime version pin needs regeneration solely for glab. Existing unrelated patches and locks stay untouched. [`scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py`, `runtime/profiles/AGENTS.md`]

Focused bump checks:

- `python3 scripts/test-profile-runtime-build.py` for target and lock invariants.
- Build each integrations archive, then run `python3 scripts/test-integrations-runtime.py BUILD_OUTPUT MATCHING_CORE_RUNTIME` on its native architecture for inventory, permissions and native version checks.
- Run `scripts/test-glab-interop.sh ABSOLUTE_CANDIDATE_BINARY` on each native target. It proves Habitat-created login → real glab API use → glab config rewrite → Habitat disconnect, and real glab login → Habitat connection.
- Run affected host closure tests (`TestIntegrationsClosurePinsTools`, `TestOnlyInstallationTargetsRequireIntegrationTools`), nativegitlab tests, and the GitLab-facing daemon/integrations and CLI tests through the focused Go runner where its fixture prerequisites are needed. These detect stale accepted versions and adapter/helper regressions.
- Use the release manifest writer/verifier on the new integrations archive with the matching core. A binary smoke test alone does not prove release closure or installation.

These checks follow `TESTING.md`; neither a whole browser suite nor changes to unrelated profile locks are justified by this research-only change.

## 3. Product features touched

- **GitLab connection discovery, connect, replace and disconnect:** `internal/nativegitlab/{store_linux,lifecycle_linux,logins,client}.go` and `internal/daemon/integrations/gitlab_linux.go`; shared native credentials remain the authority.
- **Project discovery, cloning, fetch and Git credentials:** `internal/daemon/forges_linux.go`, `gitea_clone_linux.go` (shared forge path), and `internal/cli/gitlab_linux.go`. Git uses Habitat's scoped helper, not glab's broader host-only helper.
- **Code-host settings and new workspaces:** `web/src/app/gitlab.ts`, `web/src/app/{gitlabSettings,CodeHostSettings,NewWorkspacePage}.tsx` and `web/src/components/GitLabConnection.tsx`. These consume daemon results, not CLI text.
- **Agents' direct GitLab work:** shipped `runtime/bin/glab`; new flags and changed command behavior are visible to shell tools. Installation availability and version qualification live in `internal/host/integrations_linux.go`.

No browser wire contract changes follow from replacing this executable. [Product paths above; U2, U3]

## 4. New capabilities: proposals only

1. **Better agent MR workflows:** selective title/description filling, visible conflict status, stack description templates, and explicit `mr merge --skip-ci`. Agents can use the CLI immediately; a first-class UI would require product actions, authorization/error handling and tests. Do not make skipping CI a default. [U3]
2. **Credential maintenance:** self-token rotation persistence, service-account token commands and instance-wide deploy-token listing. A product rotation action would need explicit intent, expiry/error handling and shared-store readback tests; administrative token management is not implied by ordinary GitLab connection support. [U2]
3. **Supply-chain tooling:** attestations from other GitLab instances and expanded dependency-firewall proxy support. Offering these as product workflows needs trust-root configuration, server qualification, explicit network scope and failure behavior. They do not authenticate this release automatically. [U2, U3]
4. **Minder governance/session upload:** requires a separate privacy/consent and authority decision, managed-binary pin/licence review, hook lifecycle and cleanup design, and per-user tests. Do not enable it or upload conversations in a pin bump. [U3, U8]

## 5. Evidence and limits

Completed during research: official release/API and source retrieval; source/module/config/build diff inspection; SHA-256 verification of both candidate archives; ELF architecture/static-link inspection; both-target notice generation and licence-text comparison; **arm64** `TestShippedGlabUsesHabitatsLogin` and `TestShippedGlabLoginIsAConnection` passed with version `glab 1.132.0 (00f5b8fe1)`.

The first attempted amd64 execution failed with an architecture mismatch on the arm64 research environment. It is **not** an amd64 runtime pass or a glab regression. amd64 execution, full integrations builds, live GitLab endpoints, mapped-user isolation and installation/upgrade qualification were not run. Those limits do not identify a product adaptation requirement; retain the mechanical verdict and require the focused bump checks before shipping.

Report validation passed: `python3 scripts/validate-project-view.py` (13 pages) and `git diff --check`. No pin, lock or metadata was changed.

## Sources

Primary upstream sources, retrieved 2026-11-24. Source-path references above were inspected in the two official release source archives, not inferred from current main.

- **U1:** [GitLab releases API](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases?per_page=5), including publication times and generic-package asset URLs.
- **U2:** [1.131.0 release](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0) and its [API record](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases/v1.131.0).
- **U3:** [1.132.0 release](https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0) and its [API record](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases/v1.132.0).
- **U4:** [Full comparison](https://gitlab.com/gitlab-org/cli/-/compare/v1.130.0...v1.132.0); [1.130.0 release source](https://gitlab.com/gitlab-org/cli/-/releases/v1.130.0/downloads/glab_1.130.0_source.tar.gz); [1.132.0 release source](https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0/downloads/glab_1.132.0_source.tar.gz). Relevant members: `go.mod`, `go.sum`, `LICENSE`, `internal/config/`, `internal/oauth2/`, `internal/api/`, `.gitlab/CODEOWNERS`, `.gitlab-ci.yml`, `.goreleaser.yml`.
- **U5:** Candidate [amd64 archive](https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0/downloads/glab_1.132.0_linux_amd64.tar.gz) and [arm64 archive](https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0/downloads/glab_1.132.0_linux_arm64.tar.gz); old archives use the same names with `1.130.0`.
- **U6:** [Candidate config implementation](https://gitlab.com/gitlab-org/cli/-/tree/v1.132.0/internal/config) and [API implementation](https://gitlab.com/gitlab-org/cli/-/tree/v1.132.0/internal/api).
- **U7:** [Candidate checksum list](https://gitlab.com/gitlab-org/cli/-/releases/v1.132.0/downloads/checksums.txt) and build/release configuration in U4.
- **U8:** [Minder command implementation](https://gitlab.com/gitlab-org/cli/-/blob/v1.132.0/internal/commands/minder/minder.go) and [managed binary definition](https://gitlab.com/gitlab-org/cli/-/blob/v1.132.0/internal/binarymgr/binaries/minder.go).
