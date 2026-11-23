Verdict: safe-to-bump

# gog 0.48.1 runtime assessment

Assessed 2026-11-23 against product commit `506102e93b8d1279a1a7a489eea32cd6c63d080e` and upstream tag `v0.48.1` (`44364d310173f8fc5aced529ba8633231d533919`). This is a mechanical native-binary pin, notices and verifier-fixture update, not an npm upgrade. No product contract adaptation was found. Qualification of the rebuilt integrations archives remains required; this research did not build them.

## 1. Installability and upstream changes

### Compatibility

The five-commit comparison changes command fixes, tests, documentation, Go dependencies and tracking-worker development dependencies. It does not change the auth command implementation, credential storage, keyring format, release workflow or top-level LICENSE. The source minimum remains Go 1.26.0; the preferred/build toolchain moves from Go 1.27.3 to 1.27.4, with minimum-series CI on 1.26.11. Upstream attributes this to GO-2026-6859. Both downloaded binaries embed Go 1.27.4. The shipped executable needs neither Go nor Node installed. Open Habitat's runtime Node is **22.21.1**, not the development-test Node listed in TESTING.md, and is unaffected. Sources: [U1–U4], `runtime/core/artifact-lock.json`, `runtime/profiles/integrations/artifact-lock.json`.

There are deliberate observable corrections, rather than a promise of byte-for-byte behavior:

- Gmail reply-all excludes all known send-as aliases and can retain Cc-only recipients. Default auto-reply now refuses when alias discovery fails, rather than risking self-replies; HTML-only forwarding retains a plain-text rendition and watch consumes all history pages before advancing.
- Calendar search/team paging respects `--max`; future-instance updates truncate the parent series; empty/inverted free-busy ranges and malformed attendee clears are rejected. Calendar names containing `@` resolve consistently and unavailable free-busy calendars produce warnings.
- Empty list JSON becomes `[]` for the affected comments, labels, notes and links, including results-only output. Sheets append preserves numeric tokens; multiline text cells stay on one output line.
- Drive download/export follows shortcuts. Label-field flags accept commas. Contacts search documents/enforces Google's 30-result ceiling. Tasks clears transmit explicit empty values; empty status is rejected. Sites preserves false metadata booleans; AdSense surfaces report warnings.

These changes are established by the corresponding `internal/cmd/` implementations and regression tests in [U2], not just the release title. Open Habitat passes these service commands to agents instead of decoding their command-specific result schemas. Its auth-list/import/export and service probes retain their interfaces. In particular, alias lookup does **not** require broadening product scopes: Google's sendAs.list accepts the existing `gmail.modify` and `gmail.readonly` grants [U8]; see `googleScopes`, `googleReadScopes`, `gogCommand` and `googleGrant` in `internal/daemon/integrations/google_linux.go`. Provider-side failures can still intentionally stop default auto-reply. Do not defeat that protection with an automatic `--allow-self` fallback.

### Dependencies and licences

No new Go module path is introduced by `go.mod`; `golang.org/x/tools` disappears. Updates cover Pub/Sub v2.8.1→v2.9.0, Google API v0.311.0→v0.315.0, Google auth v0.24.2→v0.24.4, OAuth2, sys, term, text, crypto, sync and generated Google APIs. The tracking-worker package changes existing development-tool versions (Cloudflare types, formatter/linter and Wrangler), not product npm inputs. That separately deployed worker is not installed by the runtime archive builder. Sources: [U2–U4], `scripts/integrations-runtime-build.py`.

The upstream MIT LICENSE is unchanged. Ran `scripts/go-binary-notices.py generate` against **both** downloaded candidate binaries into disposable scratch: it succeeded, verifying their identical module blocks, downloading module sources through the Go checksum database and collecting licences. Comparing the generated licence section bodies with the checked-in 0.48.0 notice found no changed dependency licence text and no added dependency licence section; the toolchain section is now Go 1.27.4. Both subsequent `check` commands passed. This covers linked dependencies, not merely the root licence. The generated notice is research scratch, not a committed lock change. Sources: [U3], release binaries [U5], `scripts/go-binary-notices.py`, `runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES`.

### Supply chain and age

GitHub's release API reports publication at **2026-11-16 06:34:52 UTC**, approximately seven days before assessment; the changelog heading is November 15. The release is neither draft nor prerelease and `/releases/latest` still identifies v0.48.1. Both 0.48.0 and 0.48.1 were published by the GitHub Actions bot under `openclaw/gogcli`. No repository/module-path or release-workflow migration appears in the diff; this is not an audit of organisation membership. GitHub displays verified tag and commit signatures [U1, U2, U5, U6].

This delivery path is GitHub release tarballs, **not npm**: npm registry signatures, npm provenance attestations and npm lifecycle install scripts are inapplicable to the gog bump. The product copies the executable and verified notices; it does not run upstream installation scripts. Unchanged upstream release configuration requires a signed tag and requests non-Darwin reproducible rebuilds, but delegates to a mutable `release-workflows` `@v1` reference rather than an immutable workflow commit [U7]. These are existing trust properties, not new guarantees.

Downloaded SHA-256 values match the release API asset digests and published checksum file. `SIGNING-MANIFEST.json` describes Darwin signing/notarization only; it is not Linux provenance. A GitHub attestations API lookup for the amd64 archive digest returned HTTP 404; **no Linux build attestation was verified**. Checksums and source signatures do not themselves prove binary-to-source correspondence. No new supply-chain concern relative to the existing delivery channel was found [U5–U7].

### Both Linux targets

| Target | Archive bytes (0.48.0 → 0.48.1) | Candidate executable bytes | Candidate archive SHA-256 |
| --- | ---: | ---: | --- |
| linux-amd64 | 15,018,627 → 15,028,505 (+9,878) | 45,269,152 | `dcd956e09d1222a07c1304d836f8acd55266b2fa241ef466580ced6a02453d72` |
| linux-arm64 | 13,522,612 → 13,528,457 (+5,845) | 41,484,448 | `c091fa2014dc3d5608acef4d09fb3bb4a3eb71e4cff898b5eaddd9703599e45c` |

Official assets retain `gogcli_0.48.1_linux_<arch>.tar.gz` and the `gog` executable member. Direct inspection identifies statically linked x86-64 and AArch64 ELF binaries, respectively. There are no Node native addons or runtime per-target downloads for gog. The small download deltas do not imply an exact final integrations archive size, which requires rebuilding. Sources: release APIs [U5, U6] and downloaded asset inspection.

Native arm64 `gog --version` returned `v0.48.1 (44364d31 2026-11-16T05:55:59Z)`. An initial amd64 invocation on the arm64 research environment failed with an execution-format/shell error; amd64 was inspected, not execution-qualified. No emulation result is claimed.

## 2. Required bump work and proof

Change only the gog-related packaging records in the implementation task:

1. In `runtime/profiles/integrations/artifact-lock.json`, update **both** target download filenames, URLs and SHA-256s, and **both** tool records' versions and archive references. Retain member and notice ownership.
2. Regenerate `runtime/profiles/integrations/gog-THIRD-PARTY-NOTICES` with `python3 scripts/go-binary-notices.py generate --out NOTICE AMD64_GOG ARM64_GOG`. A stale notice will fail the builder's exact embedded-module check.
3. Raise the accepted native-tool version in `internal/host/integrations_linux.go`, matching fixtures in `internal/host/integrations_linux_test.go`, and both inventory/version assertions in `scripts/test-integrations-runtime.py`.
4. Rebuild integrations separately on native amd64 and arm64 builders. Sealing regenerates `artifact.json`, file/component digests and licence membership; write and verify a fresh matching release manifest rather than reusing the old integrations archive. Unchanged core bytes may be reused only under the normal closure-verification rules.

No changes are required to either npm package-lock, core artifact lock, Cargo/crate licence records, browser lock, browser package lock, or Node/Pi version constants. No gog source patch is carried: the integrations builder ships official binary bytes. Its existing Microsoft scope patch and the unrelated core Claude bridge patch remain untouched. Sources: `scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py` (`native`, `patch_ms365_scopes`), `scripts/go-binary-notices.py`, `internal/host/integrations_linux.go`, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`.

Focused implementation checks:

- `python3 scripts/test-profile-runtime-build.py` for target selection and lock invariants; `python3 scripts/go-binary-notices.py check NOTICE BINARY` for each downloaded binary.
- `./scripts/test-focused.sh --area go --go-package ./internal/host` and `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`. Relevant tests include `TestIntegrationsClosurePinsTools`, `TestOnlyInstallationTargetsRequireIntegrationTools`, Google grant/login/disconnect/level and agent-skill tests. Fake gog tests establish product argument/storage expectations, not candidate-provider behavior.
- On **each native target**, `./scripts/build-profile-runtime.sh --target TARGET integrations NEW_ABSOLUTE_OUTPUT`, then `python3 scripts/test-integrations-runtime.py NEW_OUTPUT CORE_RUNTIME`. This checks archive records/digests, notices, native executable versions, npm closure and unchanged wrappers against the matching built core runtime.
- Generate a manifest containing the matching core and new integrations descriptors using `runtime-release manifest`, as specified by **Build and verify runtime archives** in `docs/operations.md`; its closure verifier must accept the new pins and target. `TESTING.md` requires packaging proof for changed packaging inputs.
- Use a disposable synthetic home for a candidate-native credential import/list/export round-trip if adding runtime compatibility evidence. No live account/token is needed for storage-format smoke coverage. Live Google behavior and installed distinct-UID isolation are not established by these checks.

This research ran binary hashing/format inspection, native arm64 version execution, two-target notice generation and notice checks. It did not run upstream Go tests, full integration builds, provider OAuth, product Go suites or a clean gate. Research-only validation: `git diff --check` and `python3 scripts/validate-project-view.py`.

## 3. Product features touched

- **Google account connection, grants, access levels and disconnection:** `internal/daemon/integrations/google_linux.go` uses credentials set, tokens import/export, auth list and service probes; `google_files_linux.go` observes native keyring files. Those formats are unchanged in the upstream comparison.
- **Agent Gmail, Calendar, Contacts, Drive and native document work:** `google_linux.go` generates the per-account skill and invokes the shared gog command prefix. Agents receive the corrected replies, recurrence, paging, spreadsheet precision and shortcut behavior without a new tool adapter. `skill_full_linux_test.go`, `google_linux_test.go`, `grant_linux_test.go` and `google_level_linux_test.go` cover the surrounding product contract.
- **Integration installation and release acceptance:** `internal/host/integrations_linux.go`, `scripts/integrations-runtime-build.py` and the integrations artifact lock select and validate the binary.
- **Account UI indirectly:** `web/src/app/integrations.ts` and `web/src/text/integrations.tsx` display the integration state; no browser protocol or UI change follows from this pin. Drive mirroring remains rclone's responsibility; shortcut support here applies to explicit gog download/export, not a change to mirrored-file policy. Sources: these product files and upstream diff [U2].

## 4. New-capability proposals, separate from the bump

There is no new service, login flow or command family to integrate in this patch. Existing agent access automatically gains more reliable commands. Do not bundle unrelated service expansion with the pin [U2].

Optional conductor proposal: make **explicit Drive shortcut download/export** discoverable in the generated Google skill. The newly corrected command follows a shortcut's target; a product documentation/test change could explain this as an online gog operation while retaining the current exclusion of Google-native shortcuts from rclone mirrors. This needs a focused skill review/test and synthetic example, not additional OAuth scopes or a mirroring change. It is not necessary for the bump. Sources: upstream `internal/cmd/drive_download.go` and its shortcut tests [U2], product `google_linux.go` skill text.

## 5. Verdict rationale

**safe-to-bump**: both official target artifacts exist, byte and dependency-notice checks pass, root and linked dependency licences remain compatible, and no auth/storage/product adapter change is required. The security toolchain refresh is a positive reason to update. Acceptance is still conditional on the normal rebuilt-archive and verifier checks above; the research is not a release qualification receipt. Do not mistake unverified Linux provenance or unexecuted amd64 code for proven evidence.

## Upstream sources

All retrieved 2026-11-23. Repository paths above refer to the product revision named at the top.

- [U1: v0.48.1 release notes and signature display](https://github.com/openclaw/gogcli/releases/tag/v0.48.1).
- [U2: complete v0.48.0…v0.48.1 comparison](https://github.com/openclaw/gogcli/compare/v0.48.0...v0.48.1), also inspected as a local tag-to-tag Git diff and through the GitHub compare API.
- [U3: candidate go.mod](https://github.com/openclaw/gogcli/blob/v0.48.1/go.mod) and [candidate LICENSE](https://github.com/openclaw/gogcli/blob/v0.48.1/LICENSE).
- [U4: candidate CI](https://github.com/openclaw/gogcli/blob/v0.48.1/.github/workflows/ci.yml) and [tracking-worker package](https://github.com/openclaw/gogcli/blob/v0.48.1/internal/tracking/worker/package.json).
- [U5: candidate release API, including asset URLs, sizes and digests](https://api.github.com/repos/openclaw/gogcli/releases/tags/v0.48.1), [checksums](https://github.com/openclaw/gogcli/releases/download/v0.48.1/checksums.txt), [signing manifest](https://github.com/openclaw/gogcli/releases/download/v0.48.1/SIGNING-MANIFEST.json), and [latest release API](https://api.github.com/repos/openclaw/gogcli/releases/latest).
- [U6: previous release API](https://api.github.com/repos/openclaw/gogcli/releases/tags/v0.48.0).
- [U7: candidate release workflow](https://github.com/openclaw/gogcli/blob/v0.48.1/.github/workflows/release-unified.yml).
- [U8: Google sendAs.list authorization scopes](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/list).
