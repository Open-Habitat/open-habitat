Verdict: safe-to-bump

# glab 1.124.0 → 1.130.0

Assessed 2026-11-13. This is a mechanical integrations-profile update, **not**
permission to enable new GitLab services. The native PAT/config interoperability
checks pass with the candidate on arm64, and third-party notice generation
succeeds for both release binaries. No product adaptation was identified.
The eventual bump still needs the two-target packaging checks below.

## 1. Installability and upstream changes

### Release and compatibility

The [release API](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases/v1.130.0)
reports a non-upcoming release published 2026-11-10 13:22:52 UTC, approximately
three days old at assessment, at commit `9b430a11f95ec78d87f19be071d1c381d8803630`.
The [release listing](https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases?per_page=10)
still lists it first: no newer stable release or withdrawal was observed.

This is a compiled Go executable, **not an npm package**. It has no Node engine,
npm lifecycle scripts or native Node addons. The product's actual locked Node
is 22.21.1 (`runtime/core/artifact-lock.json`); glab does not depend on it.
[go.mod at the candidate](https://gitlab.com/gitlab-org/cli/-/blob/v1.130.0/go.mod)
sets Go 1.27.0 (previously 1.27.2); both candidate binaries embed Go 1.27.3 and
`CGO_ENABLED=0`. Both are static Linux ELF executables of the advertised
architecture. The build-time Go change does not impose an installed Go or libc
upgrade on runtime users.

Read all six intervening release notes:
[1.125](https://gitlab.com/gitlab-org/cli/-/releases/v1.125.0),
[1.126](https://gitlab.com/gitlab-org/cli/-/releases/v1.126.0),
[1.127](https://gitlab.com/gitlab-org/cli/-/releases/v1.127.0),
[1.128](https://gitlab.com/gitlab-org/cli/-/releases/v1.128.0),
[1.129](https://gitlab.com/gitlab-org/cli/-/releases/v1.129.0), and
[1.130](https://gitlab.com/gitlab-org/cli/-/releases/v1.130.0).
The [comparison](https://gitlab.com/gitlab-org/cli/-/compare/v1.124.0...v1.130.0)
has substantial changes, including authentication/configuration code; this is
not merely an AutoFlow addition. The API comparison returned 749 file entries
without a comparison timeout, but collapsed many bodies. Relevant config/auth
files and go.mod were therefore fetched separately at both tags for comparison.
This was a focused compatibility review, not an audit of every changed line.

User-visible differences worth retaining in the bump handoff:

- `govern` is renamed to `minder`; package `rm` is deprecated in favour of `del`.
  Product code does not invoke these commands. The 1.125 note “removed deprecated
  flag” is a [help/example correction](https://gitlab.com/gitlab-org/cli/-/commit/f825406c1188d3964065517bd797fc8a296a7446),
  not a new runtime flag removal in that commit.
- Environment tokens now go only to trusted/configured hosts. Default-host
  selection prefers repository remotes over the configuration fallback; login
  can select a self-managed host as the default when no existing default login
  would be displaced. Existing product operations use explicit servers and the
  native config's host entries, not ambient environment credentials.
- Local glab configuration is shared across linked worktrees unless a pre-existing
  per-worktree file exists. Managed state stays global. `GLAB_PROXY` is honoured;
  the generic `PROXY` alias is removed from the schema.
- `glamour_style: dark` migrates once to `auto`, with a new global migration
  marker and `--color` setting. This can rewrite a native config on ordinary CLI
  use, but does not change the host-token schema. Habitat preserves unrelated
  YAML keys rather than regenerating the whole native configuration.
- OAuth stops retrying rejected refresh tokens, validates client IDs before the
  browser step and refuses known-expired access-only tokens. Git-credential
  output now follows the resolved authentication source. Habitat deliberately
  classifies OAuth/keyring entries as unsupported rather than refreshing them;
  its own Git helper serves the supported PAT entries.
- API writes no longer retry POST/PATCH on server errors and refuse redirects
  that turn writes into GETs. Clone URL host selection, proxy handling and
  release downloads gain correctness fixes. 1.125 updates Go for GO-2026-6809;
  1.126 updates x/net for GO-2026-6860 (upstream's stated security reasons).

Source detail: upstream `internal/config/{schema,config_file,local_config}.go`,
`internal/commands/auth/login/{login,helper}.go`, `internal/api/auth_sources.go`
and `internal/oauth2/token_source.go` at both tags; product
`internal/nativegitlab/logins.go` and `internal/nativegitlab/store_linux.go`,
`internal/daemon/integrations/gitlab_linux.go` and
`internal/cli/gitlab_linux.go`.

### Supply chain and licences

Distribution remains the same `gitlab-org/cli` GitLab project and its generic
package registry. The release links resolve to versioned registry artifacts;
both downloaded target archives match upstream `checksums.txt`. The release
includes a GitLab evidence JSON link, but this is **not** verification of a
signed build provenance attestation. No signature/attestation sidecar is listed
among the release assets, and no cryptographic publisher attestation was verified.
Npm registry signatures/provenance are inapplicable to this delivery path.
HTTPS plus upstream checksums establish consistency with the release, not an
independent compromise-resistant trust root.

The comparison's CODEOWNERS changes add AutoFlow co-owners and adjust dependency
firewall/localization ownership and bot approval coverage. No repository transfer
was observed; a source review cannot establish the absence of maintainer-account
compromise. No new installer executes during Habitat packaging: the archives
contain only `CHANGELOG.md`, `LICENSE`, `README.md`, and `bin/glab`.
Duo/Orbit on-demand downloads are separate upstream command behaviour, not
closure dependencies automatically installed by this pin change.

The upstream MIT [LICENSE](https://gitlab.com/gitlab-org/cli/-/blob/v1.130.0/LICENSE)
is byte-identical to 1.124.0. Scratch generation with
`scripts/go-binary-notices.py generate --out NOTICE AMD64_BINARY ARM64_BINARY`
succeeded: the two binaries have the same embedded module inventory, and module
retrieval/licence collection completed using the existing generator without a
new supplement. This matters because the release is vendored: embedded module
versions lack sums, so the generator obtains the release's go.sum and verifies
module downloads through Go's checksum database.

Compared with the old binary inventory, 11 modules are newly linked:

| Addition | Licence in downloaded module |
| --- | --- |
| `github.com/goproxy/goproxy` v0.27.0, `github.com/aofei/backoff` v1.2.0 | MIT |
| `github.com/yuin/goldmark/v2` v2.1.13 | MIT |
| `gitlab.com/gitlab-org/protos/gen/go/gitlab/autoflow` v0.1.13, its `/rpc` v0.1.10, and `gitlab/constraint` v0.1.1 | MIT |
| `buf.build/gen/go/bufbuild/protovalidate/protocolbuffers/go` v1.36.12-20260825204119-511051f7f437.2 | Apache-2.0 |
| `google.golang.org/grpc` v1.85.0, `google.golang.org/genproto/googleapis/rpc` v0.0.0-20261019180522-ce908d29299b | Apache-2.0 |
| `google.golang.org/protobuf` v1.36.12, `golang.org/x/mod` v0.42.0 | BSD-3-Clause, with patent texts retained |

These are explained by AutoFlow RPC, Go dependency-firewall support and Markdown
rendering, not unexplained installer dependencies. Existing modules also update,
notably client-go v3.25.0 → v3.46.1, x/net v0.60.0 → v0.62.0, Kubernetes
v0.37.1 → v0.37.2 and Docker tooling. Comparing collected LICENSE sections with
the checked-in notices found no changed licence terms; timefmt-go updates its
copyright year. Retain all collected licence, notice and patent texts, not just
MIT for the top-level binary. Sources: both tagged go.mod files, downloaded
binaries' `go version -m` inventories, module archives at
`https://proxy.golang.org/<module>/@v/<version>.zip`, and the existing
`runtime/profiles/integrations/glab-THIRD-PARTY-NOTICES`.

### Both archive targets

Measured byte sizes from official release downloads:

| Target | Old compressed archive | New compressed archive | Old executable | New executable |
| --- | ---: | ---: | ---: | ---: |
| linux-amd64 | 17,888,781 | 20,206,088 | 49,426,592 | 56,279,200 |
| linux-arm64 | 16,348,026 | 18,484,645 | 46,071,968 | 52,560,032 |

That is roughly 13% more compressed download, and 6.5–6.9 MB more extracted
executable per target. These are glab measurements, not predictions of the
complete integrations archive size. There is one per-target download and no
additional extraction-time network dependency.

Candidate SHA-256 values, independently calculated and matched against the
[checksum asset](https://gitlab.com/gitlab-org/cli/-/releases/v1.130.0/downloads/checksums.txt):

- `glab_1.130.0_linux_amd64.tar.gz`:
  `ce06313b2075af25180cd195ab3496d42bc5857c85a1c12ba996838dfe9d822c`
- `glab_1.130.0_linux_arm64.tar.gz`:
  `062d53acb0f2cbcc79a014600df1aa0fb440bb3a08a5d4900d3b49b553b22767`

Official URLs use
`https://gitlab.com/gitlab-org/cli/-/releases/v1.130.0/downloads/<filename>`.

## 2. Mechanical bump scope and proof

The later implementation should:

1. Update both target archive names, URLs and SHA-256 values and both glab tool
   version/archive references in `runtime/profiles/integrations/artifact-lock.json`.
2. Regenerate `runtime/profiles/integrations/glab-THIRD-PARTY-NOTICES` from **both**
   verified binaries. Do not reuse the old notice just because MIT is unchanged.
3. Update the accepted version in `internal/host/integrations_linux.go`, its
   expectations in `internal/host/integrations_linux_test.go`, and both inventory
   and executable expectations in `scripts/test-integrations-runtime.py`.
   Update the shipped-tool version statement in `docs/operations.md`.
4. Rebuild/seal each integrations archive. The builders regenerate component,
   file, mode/digest and licence records; regenerate the release descriptors and
   `release.json` with the new archive digest. These are release outputs, not
   substitutes for the source artifact lock.

No npm package/package-lock, browser lock, Cargo/crate licence record, core
`CoreAgentTools` constant, Ubuntu requirement or generated wire contract changes
are needed. No glab source patch is carried. The Microsoft scope patch in
`scripts/integrations-runtime-build.py` and the core bridge patch are unrelated
and must remain untouched. Keep the old named glab config fixture as historical
compatibility evidence; do not rename it merely to match the new pin.

Focused checks for implementation:

- `python3 scripts/test-profile-runtime-build.py` for lock/target and closure
  rules; `go test ./internal/host -run 'TestReleaseClosure|TestIntegrations'`
  for accepted tool/version and release closure behaviour.
- `go test ./internal/nativegitlab` and the GitLab-focused tests in
  `./internal/daemon/integrations`, `./internal/daemon` and `./internal/cli`.
  Use the repository's focused Go runner when its SDK/schema prerequisites are
  needed, as described in `TESTING.md`.
- Build `scripts/build-profile-runtime.sh --target TARGET integrations OUTPUT`
  for each target on that architecture; inspect with
  `python3 scripts/test-integrations-runtime.py OUTPUT CORE_RUNTIME` and run
  `scripts/test-glab-interop.sh ABSOLUTE_GLAB` against that built binary.
- Run `runtime-release manifest` with core and integrations descriptors for
  each target, as in `docs/operations.md` (“Build and verify runtime archives”).
  This independently validates executable architecture and the complete sealed
  file/component/licence closure. A native CLI version check alone does not.

Research evidence actually obtained: both upstream downloads/checksums, ELF and
Go build metadata inspection, successful notice generation binding both binaries,
and both `TestShippedGlab*` tests passing on arm64 against 1.130.0. These tests
exercise Habitat-written login consumption, revocation, and glab-written login
recognition using synthetic loopback GitLab. An initial amd64 execution attempt
on the arm64 research host returned `exec format error`; it is not an amd64
runtime result. Native amd64 execution, sealed full-profile builds, mapped-UID
qualification and real GitLab/OAuth/provider operation were **not** run here.

## 3. Product features affected

- GitLab connection discovery, PAT connect/disconnect and repository catalog:
  `internal/daemon/integrations/gitlab_linux.go` and catalog/handler registration
  in that directory. Availability requires the shipped glab tool, but API calls
  use the native GitLab adapter rather than parsing CLI text.
- Shared native logins and their classification/preservation:
  `internal/nativegitlab/`. The file remains the only credential store. OAuth,
  keyring and custom transport entries remain outside the supported PAT path;
  new PKCS#12 support does not automatically make them product-supported.
- Clone and subsequent Git authentication:
  `internal/daemon/gitlab_clone_linux.go`, `internal/nativegitlab/` Git/helper
  code and `internal/cli/gitlab_linux.go`. Credentials remain scoped to their
  owning user and explicit server.
- Agent and terminal use of the supplied glab executable, and installation
  closure: `scripts/integrations-runtime-build.py`,
  `internal/host/integrations_linux.go`. Agents can use new upstream commands
  themselves; no new browser service, authority or credential store follows
  from shipping them.

## 4. New capabilities — proposals only

1. **AutoFlow workflows:** 1.130 adds start/get/send/cancel, arguments/channels,
   token-organization namespace defaults and explicit local non-TLS service
   support. A product panel would need an explicit service/authentication
   contract, per-user workflow ownership, cancellation/event handling and
   browser contracts/UI. Do not silently connect sessions to AutoFlow or expose
   local service routing as part of the bump.
2. **GitLab work management:** new work-item parent/date filtering, timelogs,
   deploy-token/service-account commands, token self-rotation, release download
   clobber/skip and noninteractive stack operations are available to agents.
   Browser support would require scoped actions, permission/error presentation,
   and tests for each operation; token-management UI needs particular care not
   to become another credential store. No extra product work is necessary for
   ordinary CLI use.
3. **Dependency firewall and Minder:** Go module gating and improved registry
   proxies, agent session synchronization/redaction and the command rename are
   upstream capabilities. Product integration would need a separate decision
   on outbound data, user consent and supported agents. Do not enable session
   upload or install other agents' hooks by raising glab's pin.
4. **Additional authentication transports:** PKCS#12/DER client certificates and
   better OAuth lifecycle handling could inform a future expansion beyond the
   product's PAT adapter. Supporting those entries requires native transport or
   refresh ownership design and tests, not merely accepting more YAML fields.

## 5. Decision

**Safe-to-bump**, with the ordinary lock/notices/version-expectation changes and
focused two-target verification above. The upstream behavioural changes are
visible to CLI users, but none requires the existing Habitat PAT/file/API
contract to change. The actual arm64 interoperability tests and successful
binary-bound licence generation support that conclusion. This research does
not claim a fully built candidate runtime or live-provider qualification.

Report validation: `python3 scripts/validate-project-view.py` passed (13 pages),
and `git diff --check` passed. No pin or implementation files were changed.
