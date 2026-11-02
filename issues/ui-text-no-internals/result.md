# Result

## Delivered scope

Per Jari's final scope correction, only the explicitly named text changed:

- Icon wishes: removed the up-front character/byte/encoding explanation and the model-input/model-ID footer. Kept a short invitation to attach a reference.
- Workspace start-page card: replaced the internal file explanation with an invitation to introduce the workspace; the update state uses the same approach.
- Empty conversation: replaced the slash-command instruction with an invitation to ask the agent, including the needs-update state. **No new button or behavior.** That button needs a prototype round first.
- Finnish and English changed together; UK English inherits these strings.
- Added the copy rule to `web/AGENTS.md`.

The agent's UI reference generator copies catalog source comments as well as messages. The removed limits, input sources, start-page path and invocation now live in comments in the two catalogs and their regenerated reference files. No generator, daemon behavior, model selection, validation, session state or authority changed. Other reference files were already stale at the starting revision; their incidental regeneration was excluded.

## Catalog sweep — candidates for a later prototype/review

These are **not implemented**. Earlier exploratory edits outside the named scope were reverted after Jari's correction. Paths below are under `web/src/text/` unless noted. The sweep searched all catalogs in Finnish and English for internal paths, limits, encodings, model/transport terms and descriptions of implementation. External tool names, actual user content and technical controls are not automatically defects.

| Catalog / text | Candidate or borderline reason |
| --- | --- |
| `workspaceIconPicker.tsx`: wish label, thinking/reading, without-model alternatives and model failures | Still speaks about a model rather than choosing an icon. Keep for review rather than extend the named change. The letters hint also states a limit in advance. |
| `workspacePage.ts`: unchanged/written/committed, askModel, seen* | Success notices name `.open-habitat.yaml`, commit and push; suggestion action names the model. The seen* fragments no longer render in the removed footer. |
| `workspaceIconWrite.ts`: format and commit failures | File path and line-editing detail; useful for repair but could instead invite agent help. Preserve distinction between saved and committed. |
| `experimentalFeatures.ts`: workspace-icons shows/needs/desc | File, field, favicon, auto mode, model inputs and commit mechanism. Prototype shorter choice-and-consequence copy; keep the unpublished-change consequence. |
| `startHere.tsx`: goal hints, plus-sign hint | Explains draft preparation and navigation; borderline actionable guidance. New create button expressly deferred. |
| `models.tsx`: changeDefault description | Pi settings path and SSH mechanism could be replaced by the effect on new conversations and terminal use. Model IDs in the picker itself are necessary choices, not this issue. |
| `gitIdentity.ts`, `settingsIndex.ts` and `app/settingsIndex.ts` | `~/.gitconfig` storage explanation instead of the name/email attached to changes. Both the settings row and search description need the same prototype. |
| `heldMessages.ts`: stopUncertain | Finnish exposes daemon acknowledgement. Preserve uncertainty and held-message status without describing the daemon. |
| `conversation.tsx`: accepted | Finnish names RPC; English already says the agent accepted. |
| `conversationActions.ts`: awaitingNative | Native acceptance is an internal mechanism; describe the pending state instead. |
| `historyView.ts`: previewEnds, empty, read failure, nativeId | Native block read and snapshot language obscure the next action. Native IDs themselves can be useful diagnostic data; don't remove them indiscriminately. |
| `browserConversation.ts`: checking, incomplete event tail, nativeId | Snapshot/event-tail/native-history wording could be simpler. Keep honest uncertainty and the no-resend consequence. |
| `app.ts`, `useConversation.ts`: uncertain creation/continuation | Directs people to native history without a clear browser action. Needs a recovery-flow prototype, not just deletion of the warning. |
| `status.ts`: connection/loading details | Event connection and snapshot mechanisms; parallel loading-view work owns this area during this run. |
| `conversationJournal.ts`: forbidden/serverDown/recoveryFailed | Event-stream terminology rather than connection outcome. |
| `processTray.ts`: clear-finished, forceTitle, Taskfleet timeout | `pi-processes`, SIGKILL and snapshot language; preserve history/output deletion and force-stop consequences. |
| `backgroundStrip.ts`: extension/bridge unavailable, cleanup | Internal extension/bridge and Taskfleet distinctions may need an explanation of what remains possible. |
| `spinoffs.tsx`, `workerTerminal.ts`, `terminalPanel.tsx` | Native terminal/attach commands and shell details may be directly actionable. Keep commands where they are the action until a prototype provides a better route. |
| `editorFileTree.ts`: truncated listing | “Use native tools” is vague; might invite asking the agent. Search scope is an actual limitation worth making understandable. |
| `attachmentPreview.ts`, `browserDocument.ts`, `editorFilePreview.ts` | Encoding/format/metadata failures are already failure-time messages. Could simplify them, but keep useful download/open guidance and actual file format information. |
| `attachments.ts`, `refusals.ts`, `browserDocument.ts` | Numeric size limits appear in errors, so retain for now. History-corruption refusal includes an internal recovery path; agent-help wording could replace it later. |
| `serverAccess.tsx`: shapeHint, team format, Unix accounts remain | Up-front GitHub-name limit and identifier rules; some are external input requirements. Unix-account preservation is a consequence, not simply implementation noise. |
| `contextPage.ts` | Token estimates, session files, chars/4, Claude bridge, system prompt and accounting internals. This is a deliberately technical detail view; requires a view-level decision before shortening. |
| `recapSettings.tsx`, `settingsIndex.ts`: model exclusions/limits | Model restrictions and token controls are configurable choices, but helper copy could be reviewed. The sample technical recap is example user content, not UI implementation guidance. |
| `integrations.tsx`: personal-data skill errors, tool config errors, footer | Internal skill/config paths and a long native-storage explanation. Repair paths and privacy consequences need separate treatment. |
| `integrations.tsx`, `integrationsSettings.ts`: grants/sync/tenant errors | Scope, app consent, sync safety and credential handling are technical but consequential. Do not simplify away what agents may do or whether data was saved. |
| `serverIntegrations.tsx`, `onboardingSettings.tsx` | App separation, operator commands and host settings are admin controls. Review their prose separately from ordinary end-user helper text. |
| `ownMachines.tsx`, `accountKeys.tsx` | SSH/Tailscale setup, commands, key locations and fingerprints are external setup actions and verification steps. Not safe to treat them as disposable internals. |
| `codeHosts.ts`, `github.ts`, `gitea.tsx`, `gitlab.tsx`, `newWorkspacePage.tsx` | Native tool/config names, token scopes, credential helpers and polling details. Many are repair instructions or permission consequences; prototype the recovery guidance, retain external scope names where needed. |
| `clonePage.tsx`, `workspaceGit.ts`, `gitStatus.tsx`, `workspaceGitHub.ts` | Git commands, full-copy explanation, native auth diagnosis, byte progress. Git operations and progress are part of the user's task, but verbose helper descriptions merit review. |
| `claudeSignIn.ts`, `piCredentials.ts`, `account.ts`, `speechSettings.tsx` | Runtime/config paths and sign-in/storage explanations. Keep account-specific authorization and billing consequences; move only non-actionable implementation detail. |
| `languageSettings.ts` | Resolution-order explanation may be more detail than needed, but describes the effect of System. |
| `trash.tsx`, `worktrees.tsx`, `serverAdministration.ts` | Files/processes, commit state, quotas and shared-disk capacity are actual deletion/storage consequences and controls. Numeric values are not incidental implementation limits. |
| `composer.tsx`, `attachmentMenu.ts` | Left untouched for parallel workers. Path attachment wording and single-option helper text belong to their prototype/review. |
| File/view catalogs (`fileOffer.ts`, `viewOffer.ts`, `viewLinks.ts`, `viewHost.ts`, `palette.tsx`, editor catalogs) | Actual paths, file sizes, extensions and addresses are user data or choices, not internal implementation explanations. Keep unless a specific view prototype says otherwise. |

## Decisions for later review

- Retained one short icon attachment hint rather than deleting all helper text: it tells the person that a reference can guide suggestions without reciting constraints.
- Kept technical facts in catalog comments, rather than a new manually maintained guide: packaging already includes them verbatim in `open-habitat-ui`, keeping the facts beside the UI source.
- Empty conversation invites an ordinary-language request rather than exposing the command or introducing an unreviewed button. Jari explicitly withdrew the button addition and asked to remove the command name.
- Other candidates above await prototype/review, not automatic implementation or issue scheduling.

## Verification

Focused self-review: inspected the final diff, Finnish/English parity, generated references and before/after screenshots. No behavior or trust boundary changes. Existing stories import the production components and catalogs unchanged; no story-specific text or props required updating. Existing component tests passed unchanged.

- `npm ci --prefix web`; `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `./scripts/test-focused.sh --area web`: 168 files / 1252 tests passed, plus static/type checks.
- `./scripts/test-focused.sh --area browser --spec start-here.spec.ts`: 4 passed (desktop/mobile, light/dark, accessibility, missing/update states, draft preservation).
- `./scripts/test-focused.sh --area browser --spec lab-workspace-icon-suggestions.spec.ts`: 2 passed (suggestions, wishes, attachments, validation, dictation, accessibility).
- Browser runs used `OH_PORT_BASE=11250`, `OH_BROWSER_WORKERS=2`, private disk-backed TMPDIR and umask 077.
- Removed three assertions of intentionally removed output: model ID and two slash-command strings. They only guarded displaying those internals. State, draft, suggestion validity, send and accessibility assertions remain.
- `evidence/before-*` and `after-*`: paired PNG and static HTML, 390×844 viewport at device scale factor **2**, synthetic lab. Read and compared all four PNGs. Capture recipe: `web/lab/ui-text-no-internals.mjs`; it routes only the start-page read to an absent page. No live-user screenshot committed.

No full gate, whole browser suite, live-provider or distinct-UID claims.

## Tool/sub-workflow failures

- Supplied `/var/tmp/oh-r54/icon-wish.png` was absent on this host. Used the issue's exact quoted text and synthetic before/after evidence; no live data was needed.
- First mobile capture tried a hidden sidebar link and timed out. Changed the capture recipe to navigate to that link's href; retried successfully. Both lab processes stopped in the foreground.
- First web check found formatting/import order in the new capture recipe and an exploratory catalog edit. Formatted the recipe; exploratory edit was later reverted. Final scoped web check passed.
- An exploratory lookup for `goalStart.ts` found no file (the owner is `goalGuide.ts`); read the actual source. The subsequently withdrawn button was not implemented.
- Repeated `--spec` arguments selected only the final spec. Inspected test counts and ran icon suggestions separately; both named suites passed.
