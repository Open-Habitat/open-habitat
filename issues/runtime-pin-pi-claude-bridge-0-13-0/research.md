Verdict: needs-work

# pi-claude-bridge 0.13.0 runtime assessment

Assessed 2026-11-23 against repository commit
`506102e93b8d1279a1a7a489eea32cd6c63d080e`. No runtime inputs were changed.

**Recommendation:** take this release in a bounded compatibility change, not the
automatic mechanical-bump lane. Installation and dependency evidence are clean,
and the carried web-tools patch still applies. However, the default prompt
contract changes substantially, existing sessions are reimported under a new
prompt digest, and Claude Code tool rejection now ends a turn rather than
hanging it. Accept those semantics explicitly and cover them with the product's
synthetic provider fixtures before raising the pin. This is not evidence of a
known regression or a reason to reject upstream permanently. [S1–S4, R1–R3]

## 1. Installability, compatibility and supply chain

### Requirements and behavioral changes

Both versions declare Node `>=20`, Pi AI and coding-agent peers `>=1.5.1`.
The actual core artifact lock pins Node **22.21.1** on both architectures and
core npm pins Pi **1.5.2**: those satisfy the requirements. The newer Node
mentioned in the general testing instructions is not the shipped runtime pin.
No new engine, CPU or OS restriction appears in the bridge manifest. [S2, S3,
R1]

The upstream changelog and four-commit comparison agree on three changes:

* **Whole Pi prompt forwarding:** instead of capturing and projecting selected
  Pi prompt sections, the provider forwards Pi's rendered prompt, including
  tools, rules and docs. The Claude Code preset remains enabled by default;
  `provider.systemPromptPreset: false` or `null` disables it. Invalid values
  fail configuration loading. Prompt capture modules disappear and transcript
  rendering uses Pi AI's `getSystemMessageText`. The prompt digest now hashes
  the preset choice plus the whole prompt. An old session's first fresh query
  therefore takes the full-import path; upstream documents an uncached resend
  and loss of earlier thinking on prompt-triggered imports. A parked query
  keeps its original prompt until the next fresh query. This is a behavioral
  compatibility change even though upstream does not label it breaking.
* **Rejected tools:** when Claude Code rejects a served tool call, the bridge
  stops that query and reports an error, including when Pi has already begun
  executing the tool. It does not cancel or undo that execution. Pi-side
  permission enforcement remains essential. Unknown or wrong-case tool names
  remain Claude Code's responsibility; name matching is now exact. Invalid
  arguments can require a new user prompt instead of continued retries.
* **Access-gated models:** the bridge synthesizes `claude-mythos-5-2` and
  `claude-mythos-5-1` entries from corresponding Fable catalog entries when
  present. They are listed after other families, and upstream explicitly says
  requests fail without access. Treat the 1M-context claim as upstream's
  measurement, not product-verified entitlement. [S1, S3, S4]

### Registry and license evidence

Registry `latest` was `0.13.0` at inspection; neither inspected version was
marked deprecated. Candidate publication was **2026-11-16T21:01:04.223Z**, about
one week before assessment; predecessor publication was
2026-11-10T16:59:09.555Z. The repository and maintainer records are identical
between the versions. Their identities are deliberately not reproduced here.
There is no new install lifecycle script: the manifest's scripts remain test
and type-check commands. There are no added or changed dependency declarations,
peer requirements, bundled-dependency declarations, or manifest license terms.
[S2, S3]

Downloaded both registry tarballs and verified their bytes against registry
SHA-512 integrity. Candidate integrity is:

```
sha512-n/psYcPhGvieyXBjdY/AYNM2GDJqIdWeKYY880F3Y6HVfP/NG9ZJk6lGxIZbNbqyofo2+6VPKP3HIpzNorQqsA==
```

Both versions contain two registry signatures under key ID
`SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`.
Both signatures for each version verified using Node's `crypto.verify`, the
registry's public key, and the signed message
`name@version:dist.integrity`. This verifies registry signatures, **not**
source-to-build provenance. Neither version's `dist` advertises an attestation;
the candidate attestation endpoint returned HTTP 404. No provenance attestation
was available to verify. [S2, S5]

The bridge remains MIT; the shipped LICENSE is byte-identical (SHA-256
`69d02f920a5d0db2ccc30267c8674884e8cd5385eb96f0f82943ebb0cbc48c95`).
An isolated regeneration from the existing core lock changed **only** the root
dependency declaration and bridge package entry. In particular, it retained
`cc-session-io 0.4.1` (MIT), MCP SDK `1.32.1` (MIT), and Claude Agent SDK
`0.3.321` (`SEE LICENSE IN README.md`), with unchanged resolved URLs and
integrities throughout the dependency closure. The SDK's platform packages
retain `SEE LICENSE IN LICENSE.md`. There is therefore no new dependency
license delta in this bounded update, but the runtime bundle is emphatically
not all MIT: preserve the SDK and platform-package supplied terms. This is a
delta assessment, not a fresh legal approval of existing redistribution. [S3,
R1, R4]

### Both Linux archive targets

The bridge tarball is architecture-independent TypeScript/JavaScript; no native
`.node` modules were present in either bridge tarball. Direct download sizes:

| Measure | 0.12.0 | 0.13.0 | Delta |
| --- | ---: | ---: | ---: |
| Compressed npm tarball bytes | 253,657 | 247,239 | -6,418 |
| Registry unpacked bytes | 442,250 | 423,520 | -18,730 |
| Registry file count | 31 | 29 | -2 |

These are bridge-package sizes, not measured final core archive sizes. Existing
SDK optional platform packages remain `0.3.321` for Linux x64/arm64 (including
the existing musl alternatives in the lock). Other existing native runtime
packages and Node target downloads are unchanged. No new per-target download
is introduced by this update; the bounded lock regeneration preserved every
other package entry. The existing native-on-target build requirement still
applies separately to `linux-amd64` and `linux-arm64`. Neither full archive was
built in this research, so native execution and final compressed sizes remain
unverified. [S2, S3, R1, R4]

## 2. What a pin change must include

1. Update `runtime/core/package.json` and regenerate its `package-lock.json`
   with `npm install --package-lock-only --ignore-scripts`. Start from the
   existing lock rather than refreshing the whole dependency tree. The scratch
   experiment proved a bridge-only dependency delta is possible.
2. Update the bridge version in
   `internal/daemon/pi-device-test/package.json` and regenerate that fixture's
   lock too; otherwise tests exercise the predecessor. Update the required
   version in `internal/host/release_closure_linux.go` and its matching
   `release_closure_linux_test.go` fixture.
3. **Keep the web-tools source patch.** The exact `old` string in
   `runtime/core/bridge-patch.json` occurs once in each tarball's `src/index.ts`.
   The candidate still has no `provider.builtinTools` setting. Apply through
   `scripts/core-runtime-build.py`, retaining the turn-mode callback that
   suppresses built-in WebSearch/WebFetch outside unrestricted turns. Do not
   confuse the new system-prompt setting with a replacement for this patch.
4. No Node/tool download changed, so do **not** regenerate
   `runtime/core/artifact-lock.json` SHA-256 pins or Rust crate/license records
   for this bridge-only update. No browser input changed: leave
   `runtime/core/browser-lock.json` and browser/profile locks alone. No web
   frontend lock or contract regeneration is implied. Conversely, **rebuild
   both core archives**: their patched source bytes and component version
   changed. Regenerate complete component/file digests, retained license and
   notice inventory, artifact descriptors and release manifest digests through
   the normal builders/verifier. An old archive cannot stand in for a new pin.
   [R1, R4–R6]

### Focused acceptance evidence

Existing tests are useful but do not yet establish acceptance of the changed
prompt and rejection contracts:

* With the candidate fixture installed, run
  `node --test internal/daemon/pi-device-test/bridge-tools.test.mjs` to exercise
  actual Pi dispatch plus patched built-in-tool availability against fake
  Claude Code. Extend its fixtures to cover rejection before/during/after Pi
  dispatch: no duplicate execution, a terminal error, and a subsequent prompt
  that can proceed. Include restricted/approval-required turns.
* Add candidate prompt assertions using the fake SDK/Claude process: complete
  product instructions reach fresh queries; continuing old mirror state takes
  one reimport; stable prompts resume; a tool/rules change takes the documented
  reimport; concurrent sessions and isolated background calls stay separate.
  Keep the default preset rather than silently writing personal config.
* Run the candidate fixture's `models.test.mjs`, `bridge-transcript.test.mjs`,
  and `background-model.test.mjs`; verify that access-gated catalog entries
  cannot displace product defaults. Run affected daemon Go tests through
  `scripts/test-focused.sh --area go --go-package ./internal/daemon`, including
  title/helper provider loading and credentials/model selection.
* Run `go test ./internal/host -run 'TestReleaseClosure'` with the repository's
  test prerequisites, plus `python3 scripts/test-profile-runtime-build.py`.
  Build core on each native target with
  `scripts/build-core-runtime.sh --target linux-amd64|linux-arm64 NEW_OUTPUT`
  (one concrete target per invocation), then run
  `OH_CORE_ARTIFACT_DIR=BUILD_OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore`.
  Produce/verify complete release manifests as described in operations.

These checks establish dispatch, protocol, prompt and archive boundaries, not
real subscription entitlement, live provider behavior or distinct-UID
installation qualification. Existing fixture behavior and the limits of native
acceptance are documented in `TESTING.md`. [R2–R6]

## 3. Product features touched

| Product feature | Code paths and consequence |
| --- | --- |
| Claude-backed conversations and agent instructions | `runtime/core/agent-bin/pi`, `internal/daemon/pi_device_linux.go`: load the bridge; `internal/daemon/process-extension.mjs`: companion behavior and Pi tool-call enforcement. Whole-prompt forwarding changes what the model receives. |
| Participant/text-only/per-call-approval turns and web research | `runtime/core/bridge-patch.json`, `scripts/core-runtime-build.py`, `internal/daemon/process-extension.mjs`: built-in web tools bypass Pi dispatch and must remain suppressed; served tools must still pass through Pi's hook. |
| Conversation continuation, edits and mirrored transcript recovery | `internal/daemon/process-extension.mjs` bridge session-store/registry integration; `internal/daemon/pi-device-test/bridge-transcript.test.mjs`: unchanged mirror format and registry key, but new prompt digest/import and rejected-query finalization behavior. |
| Model selection and context-window observations | `internal/daemon/pi_models_helper.mjs`, `internal/daemon/model_observations_linux.go`: candidate catalog adds gated entries; listing is not proof of access. |
| Background titles, icons and summaries | `internal/daemon/title_linux.go`, `internal/daemon/icon-helper.mjs`, `internal/daemon/pi-device-test/background-model.test.mjs`: bridge loading and background-model choices need to keep working with the new prompt renderer/catalog. |
| Installation and release acceptance | `internal/host/release_closure_linux.go`, core builders and locks: exact accepted version, package/license inventory and target closure. |

Sources: [R1–R6]; upstream changed paths: [S3, S4].

## 4. Optional capabilities for the conductor

These are proposals, not changes made by this research or requirements to turn
on during the bump:

* **Pi-only Claude prompts:** expose `systemPromptPreset: false` only if the
  product deliberately wants that option. It would need an explicit ownership
  decision for per-person bridge configuration, UI/API semantics if exposed,
  and behavior/quality tests. Current policy says the product does not write
  `claude-bridge.json`; retain upstream's default for the compatibility update.
* **Access-aware model selection:** upstream's new gated catalog entries can
  reach the existing model picker without adding hardcoded product models.
  Better UX would distinguish catalog presence from verified access and show
  an actionable denial without selecting gated models as defaults. Do not
  invent entitlement from a model name or a subscription plan.
* **Clear rejected-tool recovery:** surface that a provider-side refusal may
  follow execution, and that retrying is not rollback. If the existing error
  presentation proves insufficient, add a focused recovery explanation rather
  than automatic tool replay. [S1, S3, R2, R5]

## 5. Verdict and evidence limits

**needs-work**, specifically compatibility acceptance and fixture coverage for
whole-prompt forwarding, first-resume reimport and rejected-tool termination.
Recommend retaining the default preset and existing web-tools patch, accepting
the documented one-time reimport, and proving those semantics before scheduling
the pin change. No source patch failure, newly introduced dependency, license
change, registry-signature failure or superseding release was found. Absence of
an attestation is recorded, not promoted into an unsupported tampering claim.
[S1–S5, R1–R6]

Research executed: registry inspection; both tarball integrity checks; both
versions' registry signature verification; complete published-package diff;
commit comparison and changelog reading; license-byte comparison; exact-once
patch applicability; isolated core lock regeneration and full package-entry
comparison. No live credentials, provider calls, archive build or native
architecture execution was used. Candidate integration tests above are **not
claimed as run**. Report-only checks: `git diff --check` and
`python3 scripts/validate-project-view.py`.

## Sources

Upstream URLs below identify the inspected records; registry records are mutable.
The Git comparison uses immutable registry `gitHead` values. A GitHub release
lookup for tag `v0.13.0` returned 404; release notes came from the committed
changelog, not a fabricated release page.

* **S1 — Changelog:** `https://raw.githubusercontent.com/elidickinson/pi-claude-bridge/5ea9bb88bd54395c1fe38cc95ec2ce1dbdcf15cc/CHANGELOG.md`, section 0.13.0.
* **S2 — Registry:** `https://registry.npmjs.org/pi-claude-bridge`, `versions[0.12.0]`, `versions[0.13.0]`, `time`, `dist-tags`.
* **S3 — Published packages:** `https://registry.npmjs.org/pi-claude-bridge/-/pi-claude-bridge-0.12.0.tgz` and `https://registry.npmjs.org/pi-claude-bridge/-/pi-claude-bridge-0.13.0.tgz`; manifests, LICENSE, README and entire `src/` diff.
* **S4 — Source comparison:** `https://api.github.com/repos/elidickinson/pi-claude-bridge/compare/d8a03f06cb136287c92984935d6fd15758520e89...5ea9bb88bd54395c1fe38cc95ec2ce1dbdcf15cc`.
* **S5 — Signing/provenance:** `https://registry.npmjs.org/-/npm/v1/keys`; `https://registry.npmjs.org/-/npm/v1/attestations/pi-claude-bridge@0.13.0`.
* **R1 — Runtime inputs:** `runtime/core/package.json`, `package-lock.json`, `artifact-lock.json`, `bridge-patch.json`, `AGENTS.md` (all under `runtime/core/`). Scratch lock regeneration used copies of these npm inputs.
* **R2 — Companion boundary:** `internal/daemon/process-extension.mjs`; `internal/daemon/pi-device-test/{bridge-tools,bridge-transcript,models,background-model}.test.mjs` and `fixtures/turn-modes/`.
* **R3 — Provider entry and helpers:** `internal/daemon/pi_device_linux.go`, `pi_models_helper.mjs`, `model_observations_linux.go`, `title_linux.go`, `icon-helper.mjs`; `runtime/core/agent-bin/pi`.
* **R4 — Build/qualification:** `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, `TESTING.md`, `docs/operations.md` (Build and verify runtime archives).
* **R5 — Policy:** `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, `scripts/AGENTS.md` (Carried patches).
* **R6 — Version acceptance:** `internal/host/release_closure_linux.go`, `release_closure_linux_test.go`; `internal/daemon/pi-device-test/package.json` and `package-lock.json`.
