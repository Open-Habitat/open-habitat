Verdict: safe-to-bump

# gog 0.39.1 → 0.48.0

Assessed 2026-11-13. This is a mechanical binary/notice/version-allowlist update, not an npm upgrade. The native credential operations Open Habitat uses remain compatible; no product adaptation was found. This verdict authorizes neither new Google scopes nor a new background service. Build and package qualification remain the bump worker's job.

## 1. Installability and upstream changes

### Runtime and both targets

The locked distribution is the official GitHub Go executable, not an npm package. The source minimum remains Go 1.26.0; the preferred and embedded release toolchain advances from Go 1.27.1 to 1.27.3. Neither the consumer nor the integrations builder must compile gog. The core lock actually pins Node **22.21.1**; upstream Node 26/pnpm 11 development and tracking-worker changes do not constrain this executable. No Node engine, npm native module or install lifecycle script is involved. Linux binaries are static ELF with `CGO_ENABLED=0`; amd64 declares `GOAMD64=v1`. Both embed release commit `f939ed37151af5b789ac08b98339fe8ddf880b09`. The Darwin minimum-OS changes do not affect either Linux target. [U2–U4, R1]

Downloaded both release tarballs and matched their SHA-256 against GitHub's asset metadata:

| Target | Archive bytes (0.39.1 → 0.48.0) | New executable bytes | SHA-256 of 0.48.0 archive |
| --- | ---: | ---: | --- |
| linux-amd64 | 14,639,839 → 15,018,627 | 45,244,576 | `8809d2f4fe95a0299b1a2a5c6bc912c4aba4b90a7b5e2c1f5cf11b9945a50004` |
| linux-arm64 | 13,179,477 → 13,522,612 | 41,484,448 | `fc40524368d2cb6213bdfe0b736b5884e1b55c6368706d7a285542cb7e559b68` |

Use `gogcli_0.48.0_linux_amd64.tar.gz` and `gogcli_0.48.0_linux_arm64.tar.gz`, respectively. These are separate upstream downloads, not a cross-target substitute. Growth is about 2.6% compressed on each target; sealed profile sizes must be measured after rebuilding. Native execution was tested on arm64 only; amd64 received digest, ELF and build-info inspection. [U1, U5]

### Compatibility across all intervening releases

The changelog and source comparison include 0.40.0 through 0.48.0, not just the final release. User-visible changes worth knowing are:

- 0.41: Gmail thread search now fails rather than silently returning partial results after a detail-fetch failure; raw draft/send input is bounded at 35 MiB.
- 0.42: expired/revoked grants return documented exit 4; failed retained requests make `batch end --continue-on-error` nonzero; malformed comma-only command allowlists and explicitly empty Docs batch names are rejected. Raw JSON preserves explicit false/zero/null values and unknown fields.
- 0.43: JSON error envelopes and additional `count`/`has_more` pagination metadata; bare invocation becomes auth/config status instead of command help.
- 0.45–0.47: Gmail query handling fixes stop silently narrowing negated, OR and quoted queries. Unmatched projections warn on stderr. Google Ads is removed from default user service sets and requires explicit opt-in. OAuth errors are redacted; narrowed Calendar reauthorization grants are preserved.
- 0.48: newly initialized backups default to local-only (existing remotes/origins retained); retries permit six backoffs, just under 94.5 seconds total, rather than three/63 seconds; Calendar rejects invalid windows and a shared page token across multiple calendars. Explicitly empty update fields now clear values. Multi-calendar JSON adds `calendarId` while retaining `CalendarID`; Docs 404 returns exit 5. Gmail empty-text fallback and outgoing attachment identifiers are fixed.

These change general CLI behavior, but none requires changing the product's consumed contract. Open Habitat explicitly selects services/scopes, never uses bare invocation, and checks success/failure rather than depending on the old auth error code. Its provider login is its own OAuth flow followed by native credential/token import, not `gog auth add` or automatic reauthorization. `auth list` still supplies `accounts`, `email`, `services` and `scopes`; token export retains its token object followed by its summary. `--home`, explicit account selection, file-backend settings and `_gogcli_key_v1_` file encoding remain supported. No token migration is mandatory. The longer API retries affect agent-invoked service commands; the product's five-second grant-list and ten-second token-export contexts remain appropriate for local store operations. [U2, U3, R2]

**Native synthetic compatibility evidence:** 0.48.0 arm64 accepted the product-shaped `auth credentials set - --insecure`, `auth tokens import -`, `auth list`, and `auth tokens export … --out /dev/stdout --overwrite` commands with `--home --no-input --json` and the explicit file backend. A second synthetic token written by 0.39.1 was listed and exported by 0.48.0 with its Calendar read-only scope unchanged. Export was exercised with pipe-backed stdout, as subprocess capture uses: direct execution against the research command runner's stdout failed to open `/dev/stdout`, but pipe-backed execution succeeded. No real credentials or provider requests were used. Source comparison found no changes to the token import/export command files. [R2, U3]

### Licence and supply chain

- Main `LICENSE` is unchanged MIT. Regenerated a candidate third-party notice **in scratch only** with `scripts/go-binary-notices.py generate --out NOTICE AMD64_BINARY ARM64_BINARY`: passed, including identical embedded module lists, checksum-database module verification, Go runtime licence and required supplemental text. The first bounded attempt timed out; a longer bounded retry completed successfully.
- Comparing generated licence sections with the committed notice found the same MIT/BSD/Apache-2.0 families and Go patent grants; the additional linked `go.opentelemetry.io/otel/log` module is Apache-2.0. No new copyleft or missing licence supplement was found. Keep the existing json5 supplemental BSD text. This is evidence from linked modules, not an assumption that the top-level MIT licence covers everything.
- `go.mod` adds `otel/log` and `x/tools` as indirect requirements; `x/tools` is not a newly linked runtime module in the inspected binary. `jose2go` and `percent` move from indirect to direct requirements, not newly introduced libraries. Google API/auth/gRPC, MCP, Kong, networking and crypto updates account for the remaining churn. The patched Go build addresses the x509 issue described by upstream. Tracking-worker npm dependencies (including Sharp/workerd) are not shipped here. [U2–U4, R3]
- Both endpoints of the comparison use `github.com/openclaw/gogcli`; no module/repository ownership move appeared in this version range. This does not independently audit maintainer account security.
- 0.48.0 was published **2026-11-05 21:09:15 UTC**, about eight days before this assessment, and GitHub `releases/latest` still named it. It was neither a prerelease nor superseded when checked. [U1, U5]
- The release workflow now requires signed tags and declares non-Darwin reproducible rebuilds. Locally verified the annotated `v0.48.0` SSH signature against upstream's committed allowed-signers policy. This verifies consistency with upstream policy, not independent identity vetting. The reusable workflow is referenced by mutable `@v1`, a remaining upstream supply-chain limitation. Asset inventory, signing manifest and checksums are published; matching GitHub digests is integrity evidence, not an independent signature over each downloaded asset. [U6]
- **npm registry signatures/provenance: not applicable** to the consumed GitHub tarballs. No npm registry metadata is used as evidence for these binaries. A GitHub attestations lookup for the arm64 archive digest returned HTTP 404; no independently verified build-provenance attestation is claimed. The source workflow's signed-tag and rebuild requirements are stronger evidence than a checksum alone, but not an attestation verification.

## 2. What the bump must change and prove

Required mechanical changes:

1. `runtime/profiles/integrations/artifact-lock.json`: both gog download filenames, URLs and SHA-256s; both component versions and archive references. Preserve `./gog` and the per-target structure.
2. Regenerate `runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES` from **both** candidate release binaries with `scripts/go-binary-notices.py`. The successful scratch generation establishes feasibility; do not carry the old module inventory forward.
3. Update the accepted gog version in `internal/host/integrations_linux.go`, its matching fixtures in `internal/host/integrations_linux_test.go`, and both version expectations in `scripts/test-integrations-runtime.py`. Leaving the host allowlist at 0.39.1 would reject the new profile.
4. Rebuild each target's integrations archive, regenerating notices, file/component inventory, descriptor, archive digest and release manifest through the existing builder and manifest writer. These are build outputs, not manually edited inventories.

No gog source patch is carried. Core/integrations npm `package-lock.json`, package manifests, browser lock, browser wheel, Rust Cargo/crate licence records and core Node/Pi/agent-tool version constants do **not** change for this bump. Do not conflate the Go notice with the Rust lock generator. Ubuntu requirements are unchanged. [R1, R3–R5]

Focused qualification for the bump:

- `python3 scripts/test-profile-runtime-build.py` for target/lock and notice binding; Go `TestReleaseClosure` and integrations release/host cases for the version allowlist and inventory acceptance.
- Build with `scripts/build-profile-runtime.sh --target TARGET integrations NEW_OUTPUT` on each target architecture, then run `python3 scripts/test-integrations-runtime.py NEW_OUTPUT CORE_RUNTIME`. Verify and manifest the complete resulting closure with `runtime-release`, not only the individual gog tarball.
- Run the affected `internal/daemon/integrations` Google grant/level/login/export tests; retain the native old-store → new-binary synthetic smoke described above because these unit tests largely use fake gog.
- `git diff --check` and the relevant project validators. Broader gated-release checks remain required when publishing, not for this research landing.

Research-document validation passed: `python3 scripts/validate-project-view.py` and `git diff --check`.

This research did **not** rebuild runtime archives, run product unit suites, qualify amd64 execution or exercise live Google consent/API behavior. Upstream itself identifies automatic reauthorization as synthetic-only and attachment delivery as contributor-reported. Do not turn packaging checks into claims about provider consent or distinct-UID installation security. [R4, U1]

## 3. Product features touched

- **Google connect, available service levels, repair and disconnect:** `internal/daemon/integrations/google_linux.go` (`gogCommand`, `googleGrant`, login completion, `googleExportRefresh`, grant revocation). The native token store is the scope authority; rclone shares the Google grant for Drive sync but is not being upgraded.
- **Native credential/file ownership and account discovery:** `internal/daemon/integrations/google_files_linux.go`, plus the file-key naming helpers in `google_linux.go`.
- **Agent access to Gmail, Calendar, Contacts, Drive and online Sheets/Docs/Slides:** the generated Google skill in `google_linux.go`. Agents gain CLI fixes and additions through the executable; the browser does not parse Gmail/calendar command JSON directly.
- **Runtime installation and verification:** `internal/host/integrations_linux.go`, `scripts/build-profile-runtime.sh`, `scripts/profile-runtime-build.py`, the integrations lock and native runtime test. A bad pin or stale notice would affect the whole integrations profile's acceptance. [R1–R5]

## 4. Optional capabilities, not bump scope

| Upstream addition | Possible product work |
| --- | --- |
| Gmail ID-only search, selected headers, raw MIME drafts, signatures/HTML-from-text; Calendar settings; Contacts batch operations | Existing authorised agents can already invoke these after the bump. Add focused skill examples only where useful; a first-class bulk-edit/draft UI would need preview, confirmation and partial-result handling. |
| Atomic Sheets/Slides/Forms batches and richer Slides formatting | Existing Google-native document guidance can mention supported batching. A product batch UI would need staged-request lifecycle and revision-conflict handling. Forms is not automatically a newly granted service. |
| Typed Gmail MCP tools and paginated Gmail/Calendar reads | A deliberate per-account gog MCP registration, explicit tool allowlists and separate send/delete approval policy. Do not silently add a second Google integration or broaden current grants. |
| Photos upload, Meet configuration, Search Console inspection | New explicit service/scope choices, provider API enablement guidance, consent and reconnect tests, and corresponding skill/catalog entries. No scope expansion in a pin bump. |
| Service-account keyring storage, auth rekey, credential-free API relay | Separate credential-model or operator decisions. Keep the existing Unix-user credential authority; do not rekey the product store behind its fixed backend configuration or introduce a central credential relay as part of the upgrade. |
| Watch tokens sourced from environment; local-first backups | Optional own-user watcher/backup lifecycle, storage/retention and destination policy. The bump must not start listeners, workers or backup jobs. |

Sources: [U1–U3], current service mapping and generated skill [R2]. These are conductor proposals, not filed issues or implementation commitments.

## Sources

Upstream (retrieved 2026-11-13):

- **U1:** [0.48.0 release](https://github.com/openclaw/gogcli/releases/tag/v0.48.0).
- **U2:** [Versioned changelog](https://github.com/openclaw/gogcli/blob/v0.48.0/CHANGELOG.md), sections 0.40.0–0.48.0.
- **U3:** [Complete source comparison](https://github.com/openclaw/gogcli/compare/v0.39.1...v0.48.0), particularly `internal/cmd/auth_list_helpers.go`, `internal/cmd/auth_tokens*`, `internal/secrets/file_keyring_safe.go`, `internal/secrets/store.go`, and `internal/config/config.go`.
- **U4:** [go.mod](https://github.com/openclaw/gogcli/blob/v0.48.0/go.mod), [release build configuration](https://github.com/openclaw/gogcli/blob/v0.48.0/.goreleaser.yaml), [LICENSE](https://github.com/openclaw/gogcli/blob/v0.48.0/LICENSE). Linked dependency licences were retrieved through the Go module proxy and checksum database by the repository generator.
- **U5:** GitHub release API metadata: [candidate](https://api.github.com/repos/openclaw/gogcli/releases/tags/v0.48.0), [previous pin](https://api.github.com/repos/openclaw/gogcli/releases/tags/v0.39.1), [latest](https://api.github.com/repos/openclaw/gogcli/releases/latest); archive bytes and ELF/Go build-info inspected locally.
- **U6:** [Release workflow](https://github.com/openclaw/gogcli/blob/v0.48.0/.github/workflows/release-unified.yml), [signer policy](https://github.com/openclaw/gogcli/blob/v0.48.0/.github/release-allowed-signers), annotated tag verified with `git verify-tag`.

Repository sources:

- **R1:** `runtime/profiles/integrations/artifact-lock.json`, `runtime/core/artifact-lock.json`, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`.
- **R2:** `internal/daemon/integrations/google_linux.go`, `google_files_linux.go`, `google_linux_test.go`, `google_level_linux_test.go`, `grant_linux_test.go`.
- **R3:** `scripts/go-binary-notices.py`, `runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES` and candidate scratch-generated notice.
- **R4:** `TESTING.md`; `docs/operations.md`, “Build and verify runtime archives”; `scripts/test-profile-runtime-build.py`; `scripts/test-integrations-runtime.py`.
- **R5:** `internal/host/integrations_linux.go`, `internal/host/integrations_linux_test.go`, `scripts/build-profile-runtime.sh`, `scripts/profile-runtime-build.py`.
