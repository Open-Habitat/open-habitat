# CLI conformance

AI-first CLI canon v4 (§1–§24); source and behavioral review of the personal
agent surface and shared CLI plumbing. `project-canon review --profile cli
--run <built-open-habitat> --json .` is advisory, not a passing gate.

The runtime probe in project-canon 0.9.3 looks for result fields at the top
level rather than under `data`, so its §2/§8/§10/§14–17 reports require manual
inspection. Its doctor probe also supplies an unsupported positional `.`;
that rejection is not evidence that bare doctor is missing. Its Rust-only
`crates/` check does not describe this Go program's package split.

| § | Status | Evidence and remaining limits |
|---|---|---|
| 1 | pass (agent) | `TestAgentModelInvalidBeforeConnection` rejects malformed model selectors, duplicate/unknown flags and thinking levels before connecting; `TestAgentModelsNativeDefaults` rejects duplicate JSON fields, query selectors and unknown body fields. `TestAgentConversationRequest` checks strict per-command flag allowlists, explicit targets, bounded file input and safety opt-ins; `TestAgentConversationControls` exercises the real own-UID socket with browser trust disabled. `TestAgentCLIContextValidation`: unknown flags, selectors, malformed IDs and mixed current/explicit targets rejected before connection. |
| 2 | pass | Central `cliError` classification and `emitError`; help advertises 0/1/2 and signal codes. JSON stdout and error stderr remain separate. Service diagnostics are JSONL. |
| 3 | pass (agent) | Reads and file export are non-interactive; no prompts, pager or TTY branch. |
| 4 | pass (agent) | Invalid target/argv and expected syntax are reported; daemon failures use fixed codes without native errors. |
| 5 | pass (agent) | Read results go to stdout; workspace list also exports JSONL to a new file and reports metadata. Notice creation accepts bounded UTF-8 from `--text-file FILE|-`; notice lists also export JSONL. |
| 6 | pass | `agent <resource> <verb>`; no declarative wrapper or native git/gh/tmux/Taskfleet replacement. |
| 7 | pass (agent) | Environment/conversation `show`, workspace/notice/model `list`, notice `create`, model `update` (explicit provider/model pair, omitted thinking preserved); conversation/message/queue/title/recap/archive/continuation controls use CRUD verbs; resume, stop and interrupt are native lifecycle operations with ownership/termination/RPC effects, not aliases for a status-field patch. |
| 8 | partial | Bare `config path/show` inspect the effective account's native Pi settings and socket; only known non-secret defaults are returned. Operator component inspection stays explicit. Identity/path are fixed by effective UID, not overridable routing config. The older operator state/config selectors do not yet provide a uniform per-key flag/env/file interface. |
| 9 | pass | Formatting depends only on explicit `--json`; text help is text, JSON help is structured. |
| 10 | pass (shared plumbing) | Version and skills share build version; full build revision or null plus provenance; structured errors and warning arrays. `TestVersionAliasJSONAndText` covers alias identity. |
| 11 | pass (notices/models); partial (conversation controls) | Model update explicitly rejects `--dry-run` as `dry_run_unsupported` rather than pretending to reserve native settings/catalog; native read-back and repeatable selection preserve unrelated settings (`TestAgentModelsNativeDefaults`). `TestNoticesNativeWriteOutcomesAndOwnership` proves no write during dry-run, persistent same-key recovery, changed-text conflict, and honest failed/uncertain persistence. Exports refuse overwrite. Conversation controls reject dry-run explicitly. They preserve the native controller's spent-command fence and do not retry; creation has no durable idempotent recovery ledger, and message command-ID reuse is refused rather than replaying the original result. This batch does not claim full §11 conformance. Existing operator mutations retain their own tests. Skill installation still has inherited partial-plan/no-clobber limitations. |
| 12 | partial (conversation model calls/services) | Conversation creation/status and recap show expose native state. Title/recap generation uses bounded synchronous calls without a separate job/progress stream; this batch does not claim full §12 conformance. Long-running service entry points still lack the full canon result/cancelled stream and signal exit mapping. |
| 13 | pass (agent) | Model catalog is capped at 100 records by the native helper. Conversation/workspace/notice list `--output FILE.jsonl`; rows carry schema version, stdout carries path/count. `TestAgentWorkspaceOutput` covers bytes and refusal to overwrite. Replies are bounded by the client. |
| 14 | pass | `helpSpecs` supplies drill-down command paths, flags/defaults/enums, arguments, examples and exits; `TestHelpDrilldownAndAgentSkill` walks every leaf. |
| 15 | partial | Operator and agent skills install as native Claude/pi/Codex trees; default runtime selection is all. Tests cover byte identity, three destinations, force/no-clobber. Omitting the skill name still does not install the whole catalog. |
| 16 | pass | `skill print agent` is embedded, version-matched, side-effect-free and byte-identical to installation. |
| 17 | partial | Printed/installed skills and version metadata share the binary version. The inherited installer does not distinguish newer/older on-disk skill versions beyond explicit force/no-clobber. |
| 18 | partial | Bare doctor now checks personal native configuration and own socket, with nonzero failures. It does not claim that pathname checks prove liveness or a kernel quota read. Failure currently uses the shared error envelope rather than a complete checks/summary document; native dependency and installed-skill audits remain incomplete. |
| 19 | partial (notices); n/a (agent reads) | Notice timestamps are daemon-owned live provenance and UUIDs are caller-supplied, not time-derived. The daemon currently takes wall time at its HTTP boundary; no frozen-time override or domain clock seam is shipped. Environment observation receives its observation time as a parameter; a frozen time must not falsify live provenance. |
| 20 | n/a | CLI owns no human-editable personal record store. Native tools own their files. |
| 21 | n/a | No personal home/bootstrap registry. Skill installation is explicit. |
| 22 | pass | CLI delegates to daemon/controller, transport, storagequota and core packages; domain operations do not depend on the parser. |
| 23 | partial (repository); pass (new surface) | New skill, templates and fixtures use neutral synthetic identities and paths; no personal defaults. Repository-wide public cleanup and configurable private-marker diagnostics remain unfinished. |
| 24 | pass (reviewed scope) | Old review-run failures are explicitly historical rather than current blockers. The second socket really requires installation/policy changes; neither native test results nor templates claim live deployment acceptance. |

Remaining partial rows are report-only conformance gaps, not claims of a fully
conformant operator CLI. Personal reads do not reach gateway sessions, editor
grants, browser terminal relays, provisioning, user lists or administration.
Kernel UID checks and a separate default-deny route table are not CLI flags.

## Workspace/destruction batch

Canon v4, scoped judgment review: the new workspace/repository/clone/worktree/
Trash surface uses strict per-command flag sets and explicit IDs (sections 1–7),
shared versioned envelopes and fixed native error codes (9–10), paired clone
show/list progress reads (12), no-clobber JSONL exports retaining observation
metadata (13), and table-derived drill-down help plus bundled workflows (14–17).
Native git/gh/tmux/Taskfleet ownership is not duplicated (22). No new persistent
routing config, identity selector, registry, credential input or clock override
is added (8, 19–21); examples remain synthetic (23). The personal authority and
live-install limits above remain unchanged (24).

Section 11 remains **partial**: race-sensitive writes reject dry-run explicitly;
existing observation tokens, typed deletion, native checks and no-replay semantics
are retained, but create/delete still have no idempotency-key recovery or symmetric
if-exists opt-ins. Section 12 remains **partial**: clone jobs have show/list with
native stage/percent, but no sequence/event window on this CLI; deletion/native
catalog calls remain bounded synchronous requests without a progress stream.
`TestAgentWorkspaceRequests`, `TestAgentWorkspaceIncompleteIsNotSuccess`,
`TestAgentWorkspaceSafety` and `TestAgentWorktreeFreshnessAndTypedForce` cover the
new parser, honest failure results and own-UID safety boundary. This is not a
whole-surface conformance pass.

## Integration/protected-input batch

Canon v4 scoped review: integration/account and credential nouns use the existing
CRUD vocabulary, own-UID transport and native stores (§§6–8,22); protected raw-key
or JSON input is bounded stdin/file only, never an environment/argv secret
interface. Error paths intentionally omit supplied values/paths on this secret
surface (§§1,4,8): echoing a rejected secret would violate redaction. Regular
own-UID non-symlink input files must exclude group/other access. Reads/replies
reuse the redacted contracts; native error text is not forwarded (§§2,9–10).
Drill-down help and bundled workflows describe all seven leaves (§§14–17).
No host record store, bootstrap, clocks, routing configuration, or privileged
operation is added (§§19–24). Accounts are capped at 64 and providers at six;
credential replies are small (§13).

§11 remains **partial**: previews explicitly return `dry_run_unsupported` before
consuming input; native account creation/removal has no idempotency recovery or
if-exists opt-in, so missing replies must not be retried automatically. §12
remains **partial**: account checks/changes use bounded synchronous native calls,
not a progress stream. OAuth/session login adapters remain unfinished, and this
is not a claim of whole-surface conformance or live provider acceptance.
`TestProtectedIntegrationInput`, `TestProtectedFilesAndErrors`,
`TestAgentCredentialsAndIntegrationRoutes`, `TestAgentPasswordAccountsNoBrowserLease`
and the extended distinct-UID probe cover this batch's changed boundaries.
