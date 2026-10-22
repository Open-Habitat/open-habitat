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
not a progress stream. The final adapter review below covers OAuth/device/subscription logins; browser
session leases stay excluded. This is not a claim of full conformance or live
provider acceptance.
`TestProtectedIntegrationInput`, `TestProtectedFilesAndErrors`,
`TestAgentCredentialsAndIntegrationRoutes`, `TestAgentPasswordAccountsNoBrowserLease`
and the extended distinct-UID probe cover this batch's changed boundaries.

## Whole agent surface review — history/auxiliary completion inventory

Canon **v4**, §§1–24, reviewed across environment/context/notices/models,
conversation controls, workspaces/repository/clone/worktree/Trash, integrations/
protected input, and history/receipt/process/attachment commands.
Conditional characterization: Q1–Q5 and Q8 apply (multiple resources, native
configuration, writes, jobs/long calls, daemon-owned timestamps, large results);
Q6–Q7 do not (no new human-editable record store or agent data-home bootstrap).
The probe table covers all 24 sections; no new canon dimension is proposed.

`project-canon review --profile cli --run <sandboxed-built-binary> --verbose
--json .` ran against the built surface in a disposable networkless Ubuntu
container with a fictional passwd entry. No real home, browser profile, native
history or credential store was probed. Its reports remain advisory: root-level
field assumptions, Rust-only layout and the unsupported doctor positional probe
still need source/test adjudication. No mechanical report is a full pass.

The matrix above remains the whole-surface judgment, **with inherited partial
rows preserved**, not a declaration that every mandate passes:

- §§1–7,9–10,14,16: new resource parsing rejects unknown/duplicate flags, bad IDs,
  missing owner/token fences and unsafe local filenames; exports have no prompts.
  `TestAgentResourceValidationAndFences`, `TestHelpDrilldownAndAgentSkill` and
  `TestAgentAuxiliaryResources` cover syntax, honest failed process outcomes,
  exact routes, native history/block revisions, receipts, attachments and local
  browser reply authority. Help describes all leaves; the version-matched skill
  documents native operations rather than wrapping git/gh/tmux/Taskfleet.
- §8 remains **partial** for inherited operator config layering. The personal
  routing identity is deliberately effective-UID-derived, not a configurable
  home/user/socket override; changing it would violate authority, not add config
  flexibility. Native tools own their settings/includes. No new config is added.
- §11 remains **partial** for writes without durable retry recovery or symmetric
  if-exists affordances, including attachment creation.
  Process stop/clear and attachment requests reject `--dry-run`
  explicitly; native safety cannot be reserved. No uncertain mutation is replayed
  or silently reselected.
- §12 remains **partial** for bounded synchronous model/native/login/file calls
  and service signal/progress conventions. Clone/show and process/list/show expose
  native progress/retention. No stream/sequence completion is claimed.
- §13: **pass for the new resources**. Native history export walks bounded
  before-pages itself, refuses mixed revisions, missing boundaries and incomplete
  tails. Block export walks bounded byte/base64 chunks; process exports preserve
  owner/token/retention/interrupted fields. Each JSONL record is one
  bounded schema-versioned response, stdout is file metadata, and binary downloads
  never enter inline JSON. Private output files refuse overwrite and are removed
  on incomplete export (`TestAgentResourceExports`). Native discovery and client
  response bounds still apply; oversized/unavailable observations error, never
  silently truncate a successful export.
- §§15,17–19,23 remain the named inherited **partial** rows (catalog-wide install,
  skill drift distinction, full doctor/dependency/marker scans, frozen domain
  clock seam, repository-wide public-artifact audit). This batch does not fix or
  rename those gaps. §20–21 remain n/a; §22 passes the native controller/parser
  split; §24 is source-checked: the final login/question adapters are implemented below;
  no permission/dependency/Fleetrepo blocker is inherited.

Security boundary evidence: the expanded `test-agent-uids.sh` probes each new
resource family and process/receipt routes under distinct root/other/gateway
kernel UIDs even with permissive socket mode. Own-UID synthetic tests disable
browser trust and preserve native process owner/token fences. Attachments share
one recount/write mutex across browser and agent adapters; browser-local request
adapters cannot claim/complete a reply. No gateway, broker, editor grant, device
link, user list or administration operation is admitted. Explicit native history
and tool output can contain sensitive user content; it is not a credential API
or a claim of universal log redaction.

Known aspirational mandate gaps remain report-only in their named matrix rows;
none was silently promoted to pass or newly filed. Operational completion of the
personal inventory and live acceptance are separate from this canon judgment.

## Final adapter reconciliation

Canon **v4**, all §§1–24, same Q1–Q5/Q8 applicability as the whole-surface review
above. The remaining question/OAuth/Pi/Claude leaves now have strict protected
input parsers, exact native request/attempt targets, paired status/cancellation,
structured help/examples and embedded workflows. `TestAgentLoginProtectedInputs`
proves rejected argv/duplicate keys/mixed actions cannot leak submitted values,
and dry-run consumes no protected input. `TestAgentPiLoginExactAttemptAndSeparateLease`,
`TestAgentClaudeLoginCannotBorrowBrowserLease`,
`TestAgentOAuthUsesOwnLeaseAndNativeFolderChecks` and the native question
spent-ID regression exercise the new adapters' ownership/generation/native
checks. The distinct-UID probe now includes each new route and question dispatch.

§§1–7,9–10,13–14,16,22 pass for these additions: question answer/cancel are genuine
one-shot native RPC transitions, not synonyms for a status patch; login resources
use CRUD. Fields which may contain a credential are deliberately omitted from
error diagnostics (§§4,8 redaction), rather than echoing a rejected secret.
No identity/config override, host record store or bootstrap is added (§§8,20–21).
URLs/device codes for human consent are intentionally returned, never passwords
or native tokens. §§23–24: new examples/stores are neutral/synthetic, there is
no asserted missing Fleetrepo/dependency blocker and live proof is explicitly
conductor-owned.

The **eight inherited partial sections remain §8,11,12,15,17,18,19,23**, report-only
under the canon's aspirational-mandate policy. §11: these writes explicitly reject
unsupported previews and forbid automatic replay, but have no durable idempotent
recovery. §12: bounded native start/submit calls pair with show/delete, but no
sequence-numbered event window/stream is added. §19: integration uses its existing
clock seam; Pi/Claude still use native live attempt timestamps/deadlines without
a frozen-time CLI override. None is silently promoted to pass. The operational
inventory is complete; conformance review completion is not full conformance.

Final transport regressions also preserve native refusal codes/domain exits on
all login paths, distinguish shared-native Pi `attempt_active` from outage, and
use native operation budgets for Pi/integration while retaining bounded Claude
status. `TestAgentLoginTransportBudgetsAndRefusals` covers query-bearing targets
and 503 uncertainty. Failed login views retain only the existing redacted native
contract in `error.result`, including human administrator-consent guidance.
The final rebuilt-binary sandbox probe was rerun after these localized fixes;
its advisory shape limitations do not alter the eight partial rows above.

## Installation foundation (not an implemented host CLI)

The `internal/host` site parser rejects unknown/duplicate/null keys and returns
fixed errors without reflecting input; its root-private operation journal uses
an injected clock and fail-closed interrupted-operation fence (§§1,4,19,21–22).
These are library primitives, **not** evidence that `host check/plan/apply` or
`host operation show` exist. Their command parsing, JSON/JSONL contracts,
configuration provenance, approved-plan revalidation, signal handling and
end-to-end convergence are not yet implemented or assessed. No matrix row above
is promoted by this foundation, and the new schema/example are not yet packaged.

The built-binary advisory run used project-canon's existing read-only probes:
doctor reported 7 ok / 2 warn / 0 fail / 20 skipped; review reported 10 mechanical
gaps, 9 manual checks, 4 passes and 6 n/a. The documented nested-`data` and doctor
positional-argument probe limitations still apply. Those results cover the old
CLI, not a successful installation interface.

## Host installation part A — read-only operator foundation

Canon **v4**, scoped to `host check`, `host plan`, `host operation show` and
shared help/skill wiring. These commands introduce no mutation or long-running
job: §§11–12/19–21 are n/a for these reads (the durable journal is machine-owned
phase intent, not a human record editor). No whole-CLI pass is claimed.

- §§1–4,9–10,14: exact command/flag sets, bounded strict site parsing and private
  input trust checks precede observations. Rejected values and native errors are
  intentionally omitted on the protected-input surface. Stable check/action/reason
  codes distinguish fail from unavailable. A blocked check/plan returns exit 1,
  stdout empty, and its versioned result under stderr `error.result.data`.
  `TestHostValidationBeforeObservation`, `TestHostReadOnlyCLI` and
  `TestHostOperationShowCLI` cover the parser and actual-root JSON adapters.
- §§5/13: results are bounded (fixed checks plus schema-bounded references), inline
  only; no export write is admitted on these strictly read-only commands.
- §§6–7: `host` owns the deliberate local operator surface; check/plan are the
  accepted installation domain verbs, not aliases for updating a stored status;
  operation show is CRUD read. There is deliberately no apply command yet.
- §8 remains **partial**: explicit absolute `--site` is the only site selector;
  result inputs report flag/release policy sources and ignored environment.
  There are no includes, substitution or per-key env/flag overlays, nor a site
  `config path/show` view. This is not uniform canon config layering.
- §§15–17: structured drill-down help and the version-pinned embedded operator
  skill describe all three commands and their limits. Existing installer drift
  and whole-catalog install gaps remain unchanged.
- §18 remains **partial**: host checks have stable codes and honest unavailable
  states, but are not a replacement for the inherited bare doctor audit. Mount
  observations never claim kernel quota enforcement or boot-gate acceptance.
- §22: CLI parsing/rendering delegates to `internal/host`; no runtime service
  imports operator authority. §§23–24: new fixtures and defaults are neutral;
  part B is unfinished local implementation, not an external dependency blocker.
  Repository-wide private-marker/doctor gaps remain unchanged.

`TestInspectionReadOnlyAndNoSecretOracle`, unsafe/unavailable and changing-input
regressions prove read-only filesystem behavior and fingerprints bound to site,
protected reference metadata (never secret-byte hashes), machine/boot and broker
observations. They cannot reserve inputs against root or authorize an apply.
Read instability is a retryable observation error, distinct from durable recovery;
unsafe journal permissions fail rather than becoming unavailable. Every plan
explicitly remains non-approvable; pool, release/generation and quota
acceptance are unavailable until their implementations land. Root and distinct
kernel-UID checks run in the synthetic networkless container, not on a live host.
The sandboxed built-binary `project-canon review --profile cli --run ... --json .`
and doctor are advisory; nested-data, unsupported doctor positional and Rust-only
layout probe limitations above still apply. The eight inherited partial rows
are not promoted to pass.
