Verdict: safe-to-bump

# glab 1.131.0 runtime research

Assessed on **2026-11-23**, against product commit
`955512e5d336a857b5e66cc6a270e6d9ae235c19`. This is permission for a mechanical
pin, notices and acceptance-constant update followed by qualification, not a
claim that the new integrations archives have already been built.

## 1. Installability and upstream changes

### Release and compatibility

The official releases API lists **v1.131.0** first, published
**2026-11-17T12:17:04.280Z**, approximately six days before this assessment.
It is not marked upcoming; no newer release appeared in the queried list.
The tag resolves to `206ebab4fc3fa590b720d2885ac890c195c46650`.
Both required Linux tarballs and the source archive were downloadable. [U1, U2]

There **is an upstream command removal**: the experimental `glab mcp` group
is gone. Open Habitat does not register that server: its GitLab integration
adapts native configuration and uses its own HTTP client and scoped Git
credential helper. Thus the removal does not require a product contract change.
A person's separately configured `glab mcp serve` process would need migration;
do not describe this as an entirely backwards-compatible CLI release. [U3;
`internal/daemon/integrations/gitlab_linux.go`, `internal/nativegitlab/client.go`,
`internal/cli/gitlab_linux.go`, `internal/AGENTS.md`]

The particularly relevant behavior change is `token rotate --self`: after
printing the replacement token, glab now writes it to the existing host's
native credential store. An environment-supplied token instead produces a
warning to update the environment. Habitat already rereads that store; no
parallel credential copy must be introduced. This operation remains an
explicit credential-changing command, not an automatic action of the bump.
OAuth login additionally validates its client ID against the token endpoint;
Habitat deliberately does not consume OAuth logins. The configuration writer
and OAuth token-source changes themselves are comment-only, and the schema
changes only descriptions, not keys/defaults. [U3, U4;
`internal/nativegitlab/{store_linux.go,logins.go,credential.go}`]

Other useful changes include response-debug token redaction, clearer API 429
wait information, and suppressing the upgrade banner in CI/nonterminal stderr.
The release notes contain both an MR tracking-branch fix and its revert: do not
advertise that fix as a delivered capability. [U1, U3]

### Runtime, architecture and size

This is a **precompiled Go executable**, not an npm dependency. Both binaries
embed Go **1.27.4**, versus **1.27.3** previously; upstream `go.mod` still says
`go 1.27.0`. GoReleaser still builds Linux with `CGO_ENABLED=0`; inspection
identifies static ELF x86-64 and AArch64 executables. There is no Node engine
constraint, Node native-addon rebuild, or recipient-side Go requirement.
The actual core Node pin in this checkout is **22.21.1**; glab does not require
changing it. Git remains necessary for Git-oriented commands. [U5, U6;
`runtime/core/artifact-lock.json`]

Downloaded-byte measurements (bytes, not estimates):

| Target | 1.130.0 tar.gz | 1.131.0 tar.gz | Old executable | New executable |
| --- | ---: | ---: | ---: | ---: |
| linux-amd64 | 20,206,088 | 19,862,295 | 56,279,200 | 55,038,112 |
| linux-arm64 | 18,484,645 | 18,169,124 | 52,560,032 | 51,380,384 |

Both retain `bin/glab`, `LICENSE` and `README.md`. The complete embedded module
blocks match between the two new target binaries. These upstream tarball sizes
are not final integrations-profile archive sizes. [U6]

New tarball SHA-256 values, computed locally and matched against upstream
`checksums.txt`:

```text
580dbca43835b47267e512476a442f6b2e8785a82b26ccacee22bd7010662b2d  glab_1.131.0_linux_amd64.tar.gz
7c4befd271203745b674caae2a69590ea5f9c6e5dee78bd3b40ba0e2a7c74749  glab_1.131.0_linux_arm64.tar.gz
```

### Licence and supply-chain review

- The main **MIT** LICENSE is byte-identical between the released source
  archives. Comparing vendored files whose basenames contain license, notice
  or copying found **183 → 178** files: every retained file was byte-identical,
  no additions, and five removals corresponding to removed dependencies.
  This supports no new licence obligation in the compared dependency notices;
  it does not replace regenerating the product's binary-bound notice. Both
  source archives also matched their published checksums. [U6]
- The module diff introduces **no new module paths**. Fourteen existing module
  versions change: Lip Gloss, retry-go, Docker CLI, go-toml, pretty, Goldmark v2,
  GitLab client-go and autoflow, and `x/{mod,oauth2,sync,sys,term,text}`.
  go-toml becomes direct rather than indirect. MCP SDK, jsonschema-go,
  segmentio asm/encoding and uritemplate disappear. The embedded binary module
  diff agrees with this pattern. [U3, U5, U6]
- Repository/module identity remains `gitlab.com/gitlab-org/cli`; the API's
  release publisher identity is the same for both versions. The complete
  `.goreleaser.yml` is unchanged, including repository, package publisher and
  release transport. This is continuity evidence, not an audit of all project
  membership changes. [U2, U5]
- **npm registry signatures and npm provenance are not applicable** to this
  acquisition path. The tarballs come from GitLab's generic package registry
  through official release links. No detached Linux signature or Sigstore/SLSA
  provenance asset was listed in the release links inspected. The API exposes
  GitLab release evidence, but that is not independently verified build
  provenance. Checksums from the same publisher establish byte agreement, not
  independent signer identity. No attestation verification is claimed. [U1, U2]
- No installer or npm lifecycle script is executed to install glab here: the
  builder copies its locked executable and notices. Upstream GoReleaser's
  `go mod tidy`, `go mod vendor` and manpage hooks are build-time operations,
  not Habitat installation hooks. Existing optional Duo/Orbit installation
  commands are not invoked by this bump. The upstream CI diff adds unit and
  integration test dependencies to the release job; no pipeline success or
  reproducible-build claim is inferred from that configuration alone. [U3, U5;
  `scripts/integrations-runtime-build.py`]

No observed regression, yanking, changed licence or anomalous dependency
addition warrants holding this release. Native execution was verified on
arm64 only; amd64 remains a qualification item below.

## 2. Mechanical bump scope and proof

The implementation should change the following together:

1. `runtime/profiles/integrations/artifact-lock.json`: the two downloads'
   filenames, URLs and SHA-256 values, and both glab tool records' version and
   archive fields. Preserve target selection, `member: bin/glab` and notices.
2. Regenerate `runtime/profiles/integrations/glab-THIRD-PARTY-NOTICES` with
   `python3 scripts/go-binary-notices.py generate --out NOTICE AMD64_GLAB ARM64_GLAB`.
   Supply both verified binaries. The generator checks equal embedded module
   lists, fetches module sources through Go's checksum database, obtains hashes
   for vendored modules from the released `go.sum`, and retains the linked Go
   runtime's licence too. The current notice will fail the module comparison;
   changing only its heading is insufficient. Then run the script's `check`
   command for each binary. [Repository: `scripts/go-binary-notices.py`]
3. Raise glab acceptance from `1.130.0` to `1.131.0` in
   `internal/host/integrations_linux.go`, the matching fixtures in
   `internal/host/integrations_linux_test.go`, and both the pin table and
   version-output expectation in `scripts/test-integrations-runtime.py`.
   These are mechanical version acceptances, not behavioral adaptations.
4. Build fresh integrations archives on native **each-target** builders.
   Their component/file inventories, licence digests and `artifact.json` must
   be regenerated, followed by the release manifest and its digest. Do not
   relabel an old integrations archive. [Repository:
   `scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py`,
   `docs/operations.md` — “Build and verify runtime archives”]

**Unaffected inputs:** core/integrations npm `package.json` and
`package-lock.json`, core artifact pins, Ubuntu requirements, browser lock,
Rust crate licence records, web lock and generated browser contracts. glab is
not a crate or npm package. No glab source patch is carried in this builder;
the Microsoft scope patch and core bridge patches remain unchanged. Existing
integration `NOTICE` does not contain a glab version to raise. [Repository:
`runtime/profiles/integrations/{artifact-lock.json,package.json,NOTICE}`,
`scripts/integrations-runtime-build.py`]

Focused bump qualification:

- `python3 scripts/test-profile-runtime-build.py` for target/version consistency
  and archive construction/refusals.
- On each native architecture, `scripts/test-glab-interop.sh ABSOLUTE_GLAB`
  against the freshly built profile's executable. It proves glab consumes a
  Habitat login, preserves it on a subsequent config write, honors disconnect,
  and produces a login Habitat and its credential helper consume.
- Native adapter tests, plus affected daemon integration/GitLab clone and CLI
  credential-helper tests through the repository's focused Go runner.
- Host tests matching `TestMergeIntegrationTools|TestIntegrationsClosure` and
  `TestReleaseClosure`; `python3 scripts/test-integrations-runtime.py PROFILE CORE_RUNTIME`
  for the built profile. Use `runtime-release manifest` and `verify` with the
  matching core and integrations to prove complete closure, not just a binary
  smoke test. [Repository: `TESTING.md`, scripts and tests named above]

These checks do not establish real-provider consent, an installed upgrade,
foreign-UID isolation or every optional upstream command. Existing release
qualification still owns those claims.

## 3. Product features touched

| Feature | Product paths and relationship |
| --- | --- |
| GitLab settings: discover/connect/check/replace/disconnect native logins | `internal/nativegitlab/{store_linux.go,logins.go,lifecycle_linux.go}`; `internal/daemon/integrations/gitlab_linux.go`; `web/src/components/GitLabConnection.tsx` and `web/src/app/gitlab.ts`. Native `config.yml`, not another credential database. |
| Repository catalog and GitLab clone workflows | `internal/daemon/{forges_linux.go,gitea_clone_linux.go}` and `internal/nativegitlab/client.go`. HTTP requests are Habitat's; glab shares the credential file rather than producing parsed catalog output. |
| Clone/pull/push authentication and agent code-host commands | `internal/nativegitlab/credential.go`, `internal/cli/gitlab_linux.go`, `internal/cli/agent/SKILL.md`. Scoped credential lookup must continue to use the latest native token. |
| Native agent/shell GitLab work | `internal/host/integrations_linux.go` supplies `bin/glab`; ordinary upstream commands gain the release's behavior. The experimental MCP command disappears, but it is not Habitat's MCP integration. |

No browser contract or UI change is needed for the pin itself. [Repository paths
in the table; U3, U4]

## 4. New capabilities: optional proposals, not bump work

- **Token renewal from settings:** upstream self-rotation now updates native
  storage. A Habitat action would need explicit authorization, GitLab version
  and token-scope eligibility (upstream documents GitLab 17.9+), redacted output,
  failure/recovery handling after server-side revocation, and native readback
  tests. Do not run rotation automatically or add token retention. [U4]
- **Self-managed attestation verification:** upstream expands Sigstore
  verification beyond GitLab.com. Agents can use the native command; a product
  UI would need a defined artifact input, issuer/trust policy and structured
  results, rather than treating any successful command as release authority.
  This does not supply an attestation for glab's own tarballs. [U3]
- **CI dependency-firewall job proxy:** new job-level start/stop support could
  support an explicitly designed CI workflow. Product support would require
  ownership/lifetime, proxy trust and network-policy decisions; never silently
  enable it for users or the runtime builder. [U3]
- **Administration/work-item helpers:** service-account token management,
  instance-wide deploy-token listing and work-item status updates are available
  to native CLI users. UI support would need separate privileged actions,
  permission checks and secret-output handling. No new default scopes are
  justified by the runtime bump. [U3]

No follow-up issue is filed: these are opportunities, not observed product
failures or accepted work.

## 5. Verdict and evidence limits

**safe-to-bump**: native file/locking contracts used by Habitat remain intact,
required downloads exist, dependency/licence comparisons reveal no new
obligation, and the removed MCP surface is not product-owned. Pin, digest,
notice and verifier-version changes can be proved by the focused checks above.

Research performed:

- Fetched release/latest metadata, the straight version comparison, both targets'
  old/new tarballs, both source archives and checksums. The API reported no
  comparison timeout, but some individual diff bodies were empty; relevant
  configuration and token changes were therefore compared from source archives.
- Verified all four binary archives and both source archives against published
  checksums; inspected ELF architecture, sizes, build info, module differences,
  main licence and vendored licence/notice files.
- Built the product's `internal/nativegitlab` test binary from the stated
  revision. With candidate **arm64** glab, all package tests passed, including
  both `TestShippedGlab*` interoperability cases. An initial amd64 execution
  attempt failed with an architecture mismatch, and an initial all-tests run
  from the repository root lacked relative testdata; neither is an upstream
  regression. The final passing run used native arm64 and the package directory.
- Candidate arm64 `glab --version` reported `glab 1.131.0 (206ebab4f)`.
- Report validation: `python3 scripts/validate-project-view.py` passed
  (13 pages); `git diff --check` passed. No issue metadata changed.
- Full notice regeneration, fresh integrations archive builds, amd64 execution,
  release closure and live-provider acceptance were **not run** in this
  research-only task; they remain bump qualification, not passing evidence.

## Sources

Upstream sources retrieved 2026-11-23; repository paths above refer to the
assessed product revision.

- **U1:** [Release and linked assets](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0);
  [release API](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases/v1.131.0).
- **U2:** [Latest release metadata](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases?per_page=5).
- **U3:** [Version comparison](https://gitlab.com/gitlab-org/cli/-/compare/v1.130.0...v1.131.0?straight=true);
  [comparison API](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/repository/compare?from=v1.130.0&to=v1.131.0&straight=true).
- **U4:** [Token rotation implementation](https://gitlab.com/gitlab-org/cli/-/blob/v1.131.0/internal/commands/token/rotate/rotate.go);
  [configuration implementation](https://gitlab.com/gitlab-org/cli/-/blob/v1.131.0/internal/config/config.go).
- **U5:** [Go module requirements](https://gitlab.com/gitlab-org/cli/-/blob/v1.131.0/go.mod);
  [release build configuration](https://gitlab.com/gitlab-org/cli/-/blob/v1.131.0/.goreleaser.yml).
- **U6:** Official release downloads (the same paths under `v1.130.0` were used
  for old/new comparison):
  [amd64](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0/downloads/glab_1.131.0_linux_amd64.tar.gz),
  [arm64](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0/downloads/glab_1.131.0_linux_arm64.tar.gz),
  [source including vendor](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0/downloads/glab_1.131.0_source.tar.gz),
  [checksums](https://gitlab.com/gitlab-org/cli/-/releases/v1.131.0/downloads/checksums.txt).
