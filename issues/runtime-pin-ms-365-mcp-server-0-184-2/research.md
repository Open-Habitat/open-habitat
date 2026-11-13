Verdict: needs-work

# Microsoft 365 MCP 0.170.1 → 0.184.2

Researched 2026-11-13 against product commit `d0c14e29c1f4dfb0363cd908cdafdf35df427428`.

**Do not perform the automatic pin-only bump.** The candidate installs, but a
pin-only experiment makes the existing native Microsoft grant test fail:
revoked consent is reported as `unreachable` instead of `refused`. The MCP
server now loads a different major MSAL from the adapter. The pinned preset
contract also changes. These are product integration work, not evidence of a
compromised or unusable upstream release.

## 1. Installability and upstream changes

### Runtime and dependency compatibility

Both versions declare Node `>=18`, MIT, and the same upstream repository.
The integrations archive actually pins Node **22.21.1** in
`runtime/profiles/integrations/artifact-lock.json` (not the development Node
version in TESTING.md). Candidate MSAL requires Node `>=20`; the pinned Node
satisfies it. Direct dependency changes are MSAL `^5.2.2` → `^7.1.1`, Zod
`^3.24.2` → `^4.6.7`, MCP SDK `^1.29.0` → `^1.32.0`, and removal of
`zod-to-json-schema`. Optional keytar, Azure Identity and Key Vault dependencies
are unchanged. No new top-level install lifecycle script was introduced. [R, D]

A scratch copy of the product manifest and lock, changing only the server pin
and running `npm install --ignore-scripts --no-audit --no-fund`, succeeded.
It resolved MSAL **7.2.2** and msal-common **16.16.2** nested under the server,
retaining the product's direct MSAL **5.6.0**. Zod became **4.6.7**. The lock grew
from 211 to 213 package records, excluding the root; only these two additions,
the server and Zod changed versions. Existing SDK and other locked dependencies
already satisfied the new ranges. A fresh unlocked install need not resolve
this same closure. [R; local lock experiment]

This split is a confirmed compatibility defect: `microsoft-native.mjs` imports
`AuthError` from the root MSAL but calls the server's `AuthManager`, whose
`msalApp` uses nested MSAL. Its errors fail the adapter's `instanceof AuthError`
check. A direct constructor probe confirmed both constructor inequality and
that a nested `AuthError('invalid_grant')` is not an instance of the root class.
The existing synthetic grant test passes with the original lock and fails with
the candidate at the first refusal case, returning `unreachable`. Native cache
import/reload/rotation completed before that assertion. Resolve the MSAL
identity mismatch (prefer a reviewed common direct pin compatible with upstream),
and rerun all refusal, outside-tenant and rotation cases; do not replace the
class check with indiscriminate acceptance of arbitrary errors. [P1; evidence below]

### Behaviour and tool contracts

The upstream comparison contains 56 commits. Release notes do not label a
major breaking release, but these changes affect observable contracts: [D, L]

- `delete-mail-message` now moves mail to Deleted Items and returns the moved
  message with a new ID; the old behaviour is exposed separately. Although the
  release note calls the addition `permanently-delete-mail-message`, the
  **published endpoints name it `delete-mail-message-skip-deleted-items`** and
  describe Recoverable Items/retention, not unconditional permanent erasure.
  Open Habitat enables `delete-mail-message`; review and test its new result
  and repeat-delete semantics without silently enabling the stronger operation.
- Account tools now obey enabled-tools, read-only and external-token controls.
  Comparing `getCombinedPresetPattern(['mail','calendar','contacts'])` between
  installed packages adds the skip-deleted-items tool, `list-rooms`, and account
  tools (`list-accounts`, `login`, `logout`, `remove-account`, `select-account`,
  `verify-login`); no previous names disappeared. The product's explicit list
  excludes these additions, while `TestMicrosoftMCPToolsPinnedServer` requires
  preset equality. Review that invariant and retain deliberate per-account
  tool restrictions rather than copying the expanded presets wholesale.
- Zod 4 changes schema generation. Upstream caps tool-definition sizes and
  argument element counts, fixes PATCH body precedence, preserves bounded
  pagination cursors, and adds delta `token` arguments. Exercise the actual
  enabled tools and schemas through Pi, not just package installation.
- Logging now excludes message content, bounds files and runs a startup
  credential self-test. Attachment download refusal and shared-listener upload
  fixes are included; these touch the already-enabled attachment helpers.
- OneNote site scopes/tool naming, Teams schemas, transcript fallback,
  application authentication and HTTP PKCE changed too, but these are not
  currently enabled product surfaces.

### Licensing and supply chain

The two tarballs' LICENSE files are unchanged. The scratch lock has **no changed
licence declarations** for existing packages; the two added MSAL packages are
MIT. Its declaration set is MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0,
Python-2.0, 0BSD, `(MIT OR WTFPL)` and
`(BSD-2-Clause OR MIT OR Apache-2.0)`. No newly introduced restrictive licence
was observed. There are no bundled `node_modules` in the server tarball; actual
third-party notices still need to be retained and checked by the archive
builder, not replaced by this metadata inventory. [R; tarballs; scratch lock]

Registry maintainer arrays, publisher identity and repository metadata match
between the versions (identities intentionally not reproduced). Both tarballs
match their registry SHA-512 integrity. Both versions' two registry ECDSA
signatures verify against the npm public key endpoint and the signed
`name@version:integrity` message. Both advertise SLSA v1 provenance. The candidate
attestation was fetched and decoded: its subject SHA-512 matches the tarball,
and its source is the upstream release workflow on `main`, commit
`385e4c85ffa9f94d9ce04ce574741e1c2f9016e4`, matching registry `gitHead` and
release notes. **The Sigstore certificate/transparency chain was not independently
verified**; decoding provenance is not that verification. [R, K, A, L]

At the observation time (~16:04 UTC), 0.184.2 was the registry `latest`, published
at **2026-11-13 08:56:57 UTC**, about seven hours old; no deprecation or newer
stable version was observed. This is little soak time, not by itself a hold.
The only install-script package in the prospective lock is existing keytar
7.9.0; production builds use `npm ci --ignore-scripts`. No new script-driven
binary download was introduced. [R; `scripts/build-profile-runtime.sh`]

### Both archive targets

The server is architecture-neutral JavaScript: the same tarball serves
linux-amd64 and linux-arm64. Download size grows **358,091 → 409,854 bytes**;
registry unpacked size grows **1,944,993 → 2,202,238 bytes** (86 → 98 files).
These are server-only sizes, not final archive sizes. Nested MSAL adds further
JavaScript payload; full archive compressed sizes were not measured. [R; tarballs]

Existing keytar is native and normally uses a prebuild installer, but scripts
remain disabled and the product sets `MS365_MCP_USE_KEYTAR=false`. This bump
introduces no new native module or architecture-specific download. Node and
other native tools retain their existing per-target artifact pins. Both target
archives still require native-architecture builds and independent sealing and
verification; neither was built in this research. [P1; builder; artifact lock]

## 2. Product bump work and focused proof

1. Resolve the direct/nested MSAL incompatibility, then update the integrations
   `package.json` and regenerate **its** `package-lock.json` without unrelated
   range churn. Include the resolved closure's engines and licences in review.
2. Carry `runtime/profiles/integrations/ms-365-mcp-server-scopes.json` forward.
   Its version is exactly guarded by `patch_ms365_scopes` in
   `scripts/integrations-runtime-build.py`; a pin-only build fails immediately.
   All seven patched tool names remain unique in candidate `dist/endpoints.json`,
   and every specified `from` field matches byte-decoded JSON values exactly.
   Thus the scope corrections are still applicable, not upstreamed. Update the
   version after review; preserve the existing `to` values and exact guards.
3. Review the mail-delete behaviour and preset delta in P1. Update the pinned
   contract test deliberately, not by permitting the new login/account tools
   or stronger deletion automatically. Update the exact server-version assertion
   in `scripts/test-integrations-runtime.py` (currently 0.170.1).
4. Build and seal both integrations archives. This regenerates their file
   SHA-256 records, component/licence inventory, retained npm notices,
   `artifact.json`, archive SHA-256s and the release manifest/digest pin.
   `runtime/profiles/integrations/artifact-lock.json` has no server tarball
   entry: npm integrity belongs in the npm lock. **No existing Node/native
   artifact-lock SHA-256 changes are warranted solely by this bump.**
5. No Rust crate/licence lock, Go binary notices, core package lock, browser lock,
   Playwright wheel, web lock or `CoreAgentTools` verifier version constant needs
   to change for this npm update. The MSAL direct pin and the scope-patch/test
   pins above do. Retain the integration NOTICE; npm package licence records are
   collected from installed packages by the builder. Core source patches and
   browser inputs are unrelated. [P2, P3]

Focused acceptance after those changes:

- `python3 scripts/test-profile-runtime-build.py` for exact scope-patch and
  builder/target guards.
- Build `scripts/build-profile-runtime.sh --target TARGET integrations NEW_OUTPUT`
  on each native target as documented in `docs/operations.md`; run
  `python3 scripts/test-integrations-runtime.py NEW_OUTPUT CORE_RUNTIME`.
- In a disposable copy of the built runtime, run its `bin/node` against
  `microsoft-native.test.mjs` with the adjacent synthetic fixture files described
  in TESTING.md. Require import, reload, rotation, refusal, outside-tenant and
  unreachable distinctions, not just startup.
- `OH_TEST_MICROSOFT_RUNTIME=... go test ./internal/daemon/integrations -run
  'TestMicrosoft'` includes the native enabled-tools/preset/scope assertions and
  existing Microsoft adapter flows. Ensure opt-in cases actually run.
- Use the documented `OH_INTEGRATIONS_PI` / `OH_CORE_RUNTIME` real-Pi checks
  (`TestPiOAuthBuiltRuntime`, `TestMCPBuiltRuntimeAgent`) for native MCP exposure
  and calls. Add focused synthetic mail-delete result coverage if the existing
  suite does not cover its new response shape.
- `go test ./internal/host -run 'TestReleaseClosure'` and the runtime-release
  manifest verifier on the produced artifacts establish inventory and digest
  closure; they do not prove real Microsoft consent or mailbox behaviour.

Sources: P1–P3 and TESTING.md, especially “Integration tools and Microsoft native
single-grant qualification”. Full runtime builds, live-provider acceptance and
mapped-UID workflows remain **not run**, not presumed passing.

## 3. Product features touched

- Outlook mail, calendar and contacts through native Pi MCP:
  `internal/daemon/integrations/microsoft_linux.go` (`microsoftMCPArgs`,
  `microsoftOutlookTools`, `microsoftOutlookSkill`).
- Single-grant import, encrypted MSAL cache, renewal and reconnect/error states:
  `runtime/profiles/integrations/microsoft-native{,-cli}.mjs`,
  `microsoft_linux.go` (`microsoftVerify`), and
  `internal/daemon/integrations/microsoft_{recover,migrate,diagnostics}_linux.go`.
- Account-scoped server registration and tool exposure:
  `internal/daemon/integrations/microsoft_server_linux.go`.
- OneDrive/SharePoint search and selective reads: `microsoftFileTools`,
  `microsoftSearchSkill` in `microsoft_linux.go`, carried scope metadata, and
  `internal/daemon/integrations/microsoft_files_linux.go`. rclone sync itself
  is unchanged, but its shared grant/state workflow needs regression coverage.
- The integration/permission status shown by `web/src/components/Integrations.tsx`
  and `MicrosoftLevels.tsx` consumes those daemon results. No wire-schema or UI
  change is inherently needed, but misclassifying revoked consent affects the
  information people receive.

Sources: named product paths and P1.

## 4. New capabilities — proposals only

| Upstream capability | Product work before offering it |
| --- | --- |
| Meeting-room enumeration (`list-rooms`), other users' calendar writes | Review explicit allowlist, delegated/shared-calendar scopes, tenant grants, writable-level policy, skill guidance and synthetic failure cases. Do not add through preset drift. |
| Planner plan creation, Teams channel tabs, OneNote page updates/IDs, SharePoint list-item delta/versions and To Do list delta | Separate service/access model and UI support where absent; explicit tools/scopes, application-consent guidance, permission-denial tests and per-service user documentation. |
| Inline attachment `contentId` and improved attachment transfer | Helpers are already enabled; assess useful agent guidance and synthetic inline-image/upload/read fixtures rather than inventing a new UI surface. |
| Eager selected tools alongside discovery; enabled-tools file | Evaluate Pi discovery cost and compatibility; explicit config generation and tests. Current bounded regex already provides a deliberate allowlist. |
| Application permissions, federated credentials and managed identity | Architecture decision first: these are not the current person's delegated grant. Define ownership, isolation, consent and audit boundaries before any credential or server support. |
| Stateless HTTP PKCE and short file URLs | No need for current local stdio servers. A remote-HTTP proposal would need separate transport, URL/token lifecycle and access-boundary design. |

Source: upstream comparison/release notes [D, L]. None of these proposals belongs
in the compatibility bump.

## Evidence and limits

Research changed no product inputs. In disposable copies:

- Original locked dependencies: `npm ci --ignore-scripts --no-audit --no-fund`,
  then `node --test microsoft-native.test.mjs`: **PASS**.
- Candidate-only pin: `npm install --ignore-scripts --no-audit --no-fund`, then
  the same test: **FAIL**, expected `{state: 'refused'}`, actual
  `{state: 'unreachable'}`. Both used development Node 22.23.2, not archive Node
  22.21.1. An initial fixture setup omitted `synthetic-entra.mjs`; that setup
  failure was corrected before the reported comparison.
- Direct MSAL constructor probe, preset comparison, seven scope-patch preimage
  comparisons, SHA-512 checks and registry signature verification: completed.
- Report validation: `python3 scripts/validate-project-view.py` and
  `git diff --check`: **PASS**.
- Provenance inspected but not cryptographically verified end-to-end. No full
  archive build, cross-architecture execution or real provider call was made.

## Sources

- **[R]** [npm registry metadata](https://registry.npmjs.org/@softeria%2fms-365-mcp-server), including both version manifests, publication times and tarball URLs;
  [candidate npm page](https://www.npmjs.com/package/@softeria/ms-365-mcp-server/v/0.184.2).
- **[D]** [upstream exact source comparison](https://github.com/Softeria/ms-365-mcp-server/compare/99f967a492bbd7ec2c04c89163120c01388bf683...385e4c85ffa9f94d9ce04ce574741e1c2f9016e4), plus the two registry tarballs' `dist/auth.js`, `dist/token-cache-storage.js`, `dist/endpoints.json`, `dist/tool-categories.js`, package manifests and LICENSE.
- **[L]** [upstream releases](https://github.com/Softeria/ms-365-mcp-server/releases), including [0.184.2](https://github.com/Softeria/ms-365-mcp-server/releases/tag/v0.184.2), [MSAL update #763](https://github.com/Softeria/ms-365-mcp-server/pull/763), [account-tool filtering #748](https://github.com/Softeria/ms-365-mcp-server/pull/748), and [mail deletion #777](https://github.com/Softeria/ms-365-mcp-server/pull/777).
- **[K]** [npm registry signing keys](https://registry.npmjs.org/-/npm/v1/keys).
- **[A]** [candidate attestations](https://registry.npmjs.org/-/npm/v1/attestations/@softeria%2fms-365-mcp-server@0.184.2).
- **[P1]** `runtime/profiles/integrations/microsoft-native.mjs`, `microsoft-native.test.mjs`, `package{,-lock}.json`; `internal/daemon/integrations/microsoft_linux.go` and `microsoft_search_linux_test.go`.
- **[P2]** `scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py`, `scripts/test-integrations-runtime.py`, `scripts/test-profile-runtime-build.py`; `runtime/profiles/integrations/{artifact-lock,ms-365-mcp-server-scopes}.json`.
- **[P3]** `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, TESTING.md and `docs/operations.md` (“Build and verify runtime archives”).
