# SharePoint file writes

## Triage analysis

**Verdict: product gap, not a missing SharePoint permission or a broken mirror rule.** A full-level account without retained sync roots had no upload route. New Microsoft sign-ins deliberately copy no libraries, and the files MCP allowlist exposed only search, browse and download. The agent's refusal accurately reflected that tool set. Registering all level applications did not change it.

The relevant files are identical between v0.1.4 (`6e85f6828`) and the analysis base (`d6655d82f`): `microsoft_linux.go`, `microsoft_files_linux.go`, `level_linux.go`, `skill_linux.go`, `internal/msmcp/areas.go`, and the Microsoft level/Integration UI sources. This was not already repaired on main.

### Mirror versus two-way sync

- `microsoftWritable` delegates to `microsoftRules.access`. **Either `Sites.ReadWrite.All` or `Files.ReadWrite.All` makes an existing SharePoint root writable.** `Sites.Read.All` or `Files.Read.All` alone does not. Full and no-send request both write scopes; drafts and read request both read scopes. The actual recorded grant, not the application/level name, determines the direction.
- In alias configs the account's recorded grant is used unless the root carries its own older grant. Legacy roots with no recorded grant default to writable: they predate read-only syncing. There is no default that turns a correctly granted site root read-only.
- A nonwritable retained root runs remote-to-local `rclone sync`; local changes are overwritten, never uploaded. A writable retained root runs bisync. Readiness markers/listings and the retained selection determine whether a pass runs at all; writable does not mean a first pass has completed.
- Historical discovery enumerates followed sites only with `Sites.Read.All` or `Sites.ReadWrite.All`, and not for a personal OneDrive. `Files.ReadWrite.All` alone therefore permits writes to an existing root but does not trigger followed-site discovery. Teams discovery is also selection/discovery, not a write restriction.
- **Current sign-in does not invoke that discovery to add roots.** Commit retains only previously selected roots, and only with a Files read/write grant. Correct full scopes plus zero roots still means zero synced libraries. Following a site or signing in again does not create a new two-way folder.

The existing synthetic level/grant tests exercise read mirrors, writable full/no-send roots, and direction changes. They pass. The reproduced blocker is the independent files-tool allowlist, not those sync rules.

### What Settings and the agent were told

For a read-only service with a local directory, Settings says the folder is a mirror, changes do not return to the service, and the next sync overwrites them. The level-change flow signs in with the chosen application's permissions and preserves retained folders. For an account with no directories, the UI instead described on-demand search/fetch and said changes do not return; that is **not** a mirror.

The shared skill warns about one-way mirrors only when such roots exist. Independently, `microsoftSearchSkill` said the server had no upload/move/share/delete tool and told the person to upload an edited local copy themselves. That second sentence explains the reported refusal for a full account with no roots.

The administrator setup's permission table (`MicrosoftLevels.tsx`) already includes **both delegated Microsoft Graph `Files.ReadWrite.All` and `Sites.ReadWrite.All`** for Full and no-send. The read/drafts applications intentionally do not have them.

### Exact checks for the person and administrator

1. In Settings → Integrations, inspect the **connected account's** level and granted/missing permissions, not merely whether the server has Full/Drafts/Read applications registered. Full (or Everything but sending mail) should hold file write grants.
2. In Entra, find the application whose client ID is registered for that selected level. Under **API permissions → Microsoft Graph → Delegated permissions**, verify `Files.ReadWrite.All` and `Sites.ReadWrite.All` and the tenant's admin consent. The person's own library rights still apply; application registration alone is not consent.
3. After changing consent, sign in to that connection again even if Settings already shows Full: tool filtering uses the grant recorded at sign-in. No automatic widening was added.
4. With full consent and no retained roots, **v0.1.4 needs the product/runtime update below**, not another permission grant or a new sync selection. Downloaded files remain local copies until explicitly uploaded.

## Implementation

Jari approved enabling file writes through the existing per-account Microsoft MCP authority on 2026-11-22. No credential store, gateway authority or new generic Graph route was added.

The files area and anchored enabled-tool regex now include eight pinned-server tools: `upload-file-content`, `create-upload-session`, `create-onedrive-folder`, `move-rename-onedrive-item`, `copy-drive-item`, `delete-onedrive-file`, `share-drive-item`, and `create-drive-item-share-link`. Each mutator's runtime metadata requires either broad write scope. Native `--allowed-scopes` excludes registration and dispatch for read-only grants. Generic batch, permission deletion and preview remain excluded.

Deletion, invitation sharing and share-link creation use the existing browser permission question. The question reads metadata through the same account's files relay, identifies the target and consequence, includes the complete call, and blocks on denial or without a browser. This remains a mistake guard in Habitat conversations, not isolation from the person's own shell or independently launched Pi.

The generated skill and Settings now describe explicit writes without whole-library sync. Upload instructions resolve drive/parent IDs, prefer an upload session with conflict behavior `fail` or `rename`, explain that creating a session is not uploading bytes, and require checking completion. Inline upload is recommended only for content under 2 MiB and an explicitly requested replacement; it is not silently treated as safe creation. Uncertain writes must be observed before retry. The namespace description now advertises conditional writes too.

### Release requirement — integrations runtime must be rebuilt

**Do not deploy this as a binary-only update or reuse the old integrations archive.** `runtime/profiles/integrations/ms-365-mcp-server-scopes.json` is a runtime build input. Unpatched upstream metadata names narrower scopes the applications did not consent to; enabling those tools against that runtime can break token requests, including other Microsoft tools. Release preparation fingerprints these inputs and rebuilds on a cache miss. The product and matching rebuilt integrations runtime must travel together. No additional Entra permission is needed for an already correctly consented Full account.

## Verification

All final checks below passed under `umask 077` and bounded timeouts; scratch-using commands held the shared scratch lease. The tested implementation is commit `e7a2adab1`, developed from `d6655d82f`.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`, with `OH_TEST_MICROSOFT_RUNTIME` pointing to a disposable copy of pinned 0.170.1 patched by the production builder function. Includes Full/no-send/read/drafts tool listings, each broad write scope alone, no files grant, and direct disabled `tools/call` refusals. No pinned-runtime skip in this run.
- `TestMicrosoftMCPToolsPinnedServer` also runs `testdata/microsoft-file-writes.mjs`: fake Graph client verifies decoded small-upload bytes, session target and conflict body, no byte upload during session creation, and mkdir/move/copy serialization.
- Focused Go packages `./internal/msmcp` and `./internal/daemon` passed. Their unrelated opt-in host/root/native-environment cases retain their normal skips; this is not distinct-UID qualification.
- `node --test internal/daemon/pi-device-test/microsoft-permission.test.mjs`: 8 passed, including exact-account/call allow and deny, three file guards, and no-browser refusal without metadata lookup.
- `./scripts/test-focused.sh --area web`: lint/typecheck and 253 test files / 2054 tests passed.
- Focused browser run: `OH_BROWSER_WORKERS=2`, `--spec integrations.spec.ts --spec permission-question.spec.ts --tag 'Microsoft connects|account level|no-send level|@permission-question|@a11y Tiedot'`: 6 passed, including desktop/phone accessibility and confirmation interactions.
- `./scripts/test-focused.sh --area contracts`: generation clean and schemas/fixtures valid.
- `python3 scripts/test-profile-runtime-build.py`: 16 passed. Its existing drift test now selects search-query by name rather than assuming it is the first patch entry.
- `python3 scripts/test-prepare-release-closure.py`: 6 passed.
- `scripts/package-release.sh` produced a disposable linux-amd64 product archive against the fresh web build. This is a packaging check, **not** a release or a rebuilt integrations archive.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and `git diff --check` passed.

Initial local failures were corrected: an obsolete skill expectation, the pinned server's refusal envelope being a tool error rather than a JSON-RPC error, and the patch test's first-entry assumption. Final reruns passed. Dependency installation reported existing npm audit advisories; no dependency versions were changed.

### Independent review and assessment

Critical `/llm-review` used **claude-fable-5-2** as finder and **gpt-6-astra** as verifier because this changes integration write exposure and destructive-operation guards. `/assess-findings` recorded five FIX outcomes (runtime release requirement, picker names, consent/re-sign-in guidance, inline upload size guidance and namespace description), all addressed. Two residual claims were dropped: a presentation-only recipient-summary omission and unverified provider path decoding. No follow-up issue was filed. No authorization defect remained after local checks and verification.

Review/assessment evidence is retained outside git under `/var/tmp/agent-keep/sharepoint-write-refused/`. Raw model claims are not test receipts: the reported passing checks above were run by this worker. The reviewer initially used an overlong socket TMPDIR; this worker's focused msmcp run passed using the repository runner.

### Limits and acceptance still needed

No real installation, credentials or Graph tenant was accessed. The fakes prove request construction and filtering, **not** successful live upload. In particular, the pinned adapter percent-encodes the `parent:/filename:` parameter; its own tool tip recommends that form, but Graph's handling was not exercised. After deploying the matching rebuilt runtime, test creation and content readback on a disposable destination, same-name conflict refusal, a session-based larger upload, denial of delete/share, and absence of writes at Read/Drafts. Do not call that live acceptance complete from these tests.

The full clean gate and whole browser suite were intentionally not run; neither was required for this focused worker. Building/publishing a release runtime archive and live acceptance belong to release/deployment, not this synthetic run.

## Decisions for later review

- No-send retains file writes, as its existing grant differs from Full only in mail sending. Restricting writes to the label Full would contradict that grant and level promise.
- Keep the 4 MiB relay line bound. Recommend under 2 MiB raw inline content and upload sessions otherwise rather than enlarge every MCP request for file bytes.
- Preserve explicit re-sign-in after consent changes rather than automatically broaden the agent's recorded grant. Settings recovery text makes the extra step explicit.
- Preserve native upload/session tools and account authority; do not add a Habitat upload proxy or generic Graph batch escape route.
