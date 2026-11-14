# CLI conformance

AI-first CLI canon v4 (§1–§24); source and behavioral review of the personal
agent surface and shared CLI plumbing. `project-canon review --profile cli
--run <built-open-habitat> --json .` is advisory, not a passing gate.

The runtime probe in project-canon 0.9.3/0.9.4 looks for result fields at the top
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
  no permission/dependency/installation-tooling blocker is inherited.

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
no asserted missing installation-tooling/dependency blocker and live proof is
explicitly maintainer-owned.

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

## Host apply executor

Canon **v4**, scoped to `host check/plan/apply`, explicit preparation, operation
inspection and shipped site/operator materials. The executor is no longer an
always-refusing slice. Existing whole-surface partial rows remain unchanged.

| Sections | Scoped judgment and evidence |
| --- | --- |
| 1–4 | Strict flag/site parsing precedes observation; rejected protected values are omitted. Root-only trusted file ancestry, exact pinned-target/profile and native collision checks fail closed. Typed stale/busy/recovery/immutable/domain failures remain distinct from native-action/system failures. |
| 5–7,9–10 | Site and explicit approved observation, no prompts, versioned data/error envelopes and explicit JSONL output. Live `--json` is rejected, not silently converted. |
| 8 | `host config path/show [--site PATH]` reports the selector/provenance, effective declaration and fixed trusted runtime/operation paths. Secret values never enter these documents. Privileged site inputs deliberately ignore environment overlays/includes; inherited operator component config gaps remain **partial**. |
| 11 | No-write dry-run; shared-lock approval revalidation, protected-binding checks around actions, exact-input continuation, verified no-op repeats. `TestApplyLockedRevalidationAndResume`, `TestApplyResumeReceiptFirstPublication`, `TestApplyRefusesProtectedInputDriftDuringActions`, broker exact-unpublished completion/refusal tests and the production VM fixture distinguish these from replaying journal phases or reseeding occupied state. Named ACL readers, shared gateway identities and foreign unit policy are refused, not repaired. |
| 12 | Explicit progress with monotonic seq and one terminal result/error/cancelled record; operation show remains inspectable intent. SIGINT/SIGTERM retain 130/143; a crash lacks a terminal and leaves an unknown outcome. `TestApplyFailureRefencesBeforeUnlock` proves returned failure/cancellation restores closure under the lock using an independent context, or honestly reports `entry_closure=unavailable`. VM SIGKILL boundaries are not graceful signal-delivery evidence. |
| 13–14 | Bounded plans and operation/config documents; table-driven drill-down help names approval/output/continuation rules. |
| 15–17 | Embedded, build-version-matched operator skill ships with schema/example in the package inventory. Whole-catalog/drift partials remain inherited. |
| 18–21 | Inherited doctor/clock completeness remains **partial**. The library injects the operation clock; there is no frozen-time CLI override. No native user-state registry or editable host record store is added. |
| 22–24 | CLI delegates to the host library and fixed native adapters. Runtime authorities gain no installer capability. Neutral paths/examples; actual VM and final-review evidence belongs in the implementation result rather than inferred from a library test or signed inventory alone. |

The product archive must match GitHub's stated digest before root execution.
The runtime manifest, pinned by its digest in the site, authenticates its exact
closure and, for an upgrade, the successor's product files. Neither checksum-only
packaging nor a dpkg version read alone proves installation or mapped-user
startup. Canon mechanical reports remain advisory with the probe limitations
listed above; no staged issue-creation command is executed.

## Host storage baseline — read-only continuation

Canon **v4**, scoped to existing `host check/plan` storage observations and the
shipped operator skill; this read-only adapter itself adds no command/flag,
prepare mutation, boot gate or apply executor. Q1/Q2 apply; this slice adds no
writes, jobs, timestamps,
editable record store, bootstrap or large outputs (Q3–Q8). The earlier whole-CLI
matrix and its eight inherited partial sections remain unchanged.

- §§1–7,9–10,13–14: existing strict parser, bounded typed checks, protected-input
  redaction and blocked-result/exit conventions remain. New storage checks are
  finite, read-only observations, never prompts, conversion commands or a hidden
  EDQUOT write test. `TestStorageFailuresDoNotReachLaterProbes`,
  `TestStorageKernelFailureIsNotEnforcement` and `TestStorageReadOnlyQualificationAndBinding`
  cover failure classification, no native error reflection, no writes and mount
  replacement invalidating fingerprints. `TestHostReadOnlyCLI` still passes as
  actual root. Mount options alone never become enforcement evidence.
- §§8,18 remain **partial**: no uniform site configuration overlays/config
  inspection or whole-doctor completion is added. Check now reads the actual
  journaled user-quota format and pinned-mount kernel enforcement flags; this
  does not prove boot ordering, successful prepare or EDQUOT.
- §§11–12 remain **partial** for the existing apply surface. Every plan stays
  non-approvable; apply's independent always-refuse boundary remains. That
  read-only adapter establishes neither recovery nor cancellation-after-write
  or activation; current preparation evidence is scoped separately below.
- §§15–17: the embedded and packaged version-pinned operator skill describes the
  exact storage checks, internal-quota-only qualification and required customer
  offline work. Existing catalog-install/drift limitations are unchanged.
- §§19–21 are n/a to these new reads. §22: host qualification stays in the host
  library; storagequota only adds a read-only pinned-descriptor primitive, not
  installer authority in a runtime role. §§23–24: neutral fixtures/paths and
  explicit local unfinished implementation, not an inherited external blocker.

At final runnable source `76d605b2`, project-canon **0.9.4** doctor and sandboxed
built-binary `review --profile cli --run <wrapper> --json .` completed: doctor
7 ok / 2 warn / 0 fail / 20 skipped; review 10 mechanical gaps / 9 manual
checks / 4 passes / 6 n/a. Its nested-`data`, unsupported positional doctor and
Rust-only layout limitations still apply. No generated issue commands were
executed. The probe runs fixed read-only commands inside disposable networkless
Ubuntu, without real homes/credentials; it does not exercise successful host
preparation. Native unmounted e2fsprogs-image tests validate superblock offsets;
synthetic mount/kernel callbacks are explicitly not real quota/boot evidence.

The clean rebase retained independent main editor/skill work. At `7a000f30`,
the rebuilt-binary sandboxed doctor/review and all focused checks were rerun;
the counts and limits above are unchanged. Rebased host fixes are `6e1a5977`.

## Runtime release part A — authentication/staging libraries only

Canon **v4**, §§1–24; reviewed against the vendored canon and existing host
surface. **No CLI command, flag, output schema or skill surface was added.**
`EncodeRelease`, `AuthenticateRelease`, `Select`, `CheckRuntimePackages` and
`StageRelease` are library seams, not a completed release-builder/verifier or
host installer interface. The eight inherited partial sections **8,11,12,15,
17,18,19,23** stay partial.

| Sections | Scoped evidence/limits |
| --- | --- |
| 1,4,22 | Strict authenticated input rejects unknown/duplicate/case-aliased/missing/null fields, wrong key/domain/target, invalid profile DAGs and conflicting locks. Errors omit supplied/native text. Root staging cannot accept a parsed-but-unauthenticated or zero capability. `TestReleaseAuthenticationAndStrictWire`, `TestReleaseProfilesAndPackageDrift`, `TestReleaseHostileAuthenticatedArchives` cover these library boundaries, not a new CLI parser. |
| 2–3,5–10,13–18 | No new command/envelope/format/config/help/skill contract. Existing CLI judgments above remain; release trust bootstrap and a real package observer are not exposed by this part. Explicit observation distinguishes exact package drift from unavailable data; it is not host readiness. |
| 11–12 | Existing apply remains blocked. Staging is a root-only private scratch operation with context cancellation/cleanup, not idempotent generation publication, a dry-run, durable retry recovery or a streaming/signalled CLI. `TestReleaseStagingAndFailureBoundaries` and actual-root `TestReleaseRootAndDistinctUID` cover its narrower scope. No promotion to pass. |
| 19–21 | No wall-clock provenance, human-editable record writer or bootstrap command is introduced. Random scratch names are not persistent operation identity; the existing journal still owns that. |
| 23–24 | New keys/identities/archives are synthetic. No personal profile, credentials or environment defaults are copied. Remaining closure/profile/bootstrap work is explicitly local unfinished implementation, not an asserted external dependency or permission blocker. |

The rebuilt-binary sandbox probes ran with project-canon **0.9.4** in a fresh
networkless Ubuntu container, without real homes/credentials mounted.
`doctor --json .`: **7 ok, 2 warn, 0 fail, 20 skipped**.
`review --profile cli --run <sandbox-wrapper> --json .`: **10 mechanical gaps,
9 manual checks, 4 passes, 6 n/a**. All staged commands were left unexecuted.
The probe still assumes top-level fields instead of this CLI's `data` envelope,
passes an unsupported positional `.` to doctor, and checks Rust layout; source
and existing CLI tests, not that mechanical output, determine the judgments
above. These advisory runs exercise the inherited surface, not the unimplemented
bootstrap CLI. Package reproducibility/checksums still do not establish
release authenticity; synthetic manifest/staging tests do not qualify real runtime
archives or an independent customer installation.

After additive reconciliation with the parallel storage slice, the runtime
adapter/test files remain byte-identical to reviewed `ecfa503a` (rebased fix
`1934d39c`). All focused checks and rebuilt sandboxed doctor/review were rerun
at combined tree `b49c71d4`; counts and limits above are unchanged. Both storage
and runtime tests/authority boundaries were retained, not replaced.

## Runtime package observation — native dpkg read only

Canon **v4**, §§1–24, scoped to `AuthenticatedRelease.ObserveRuntimePackages`.
No command, flag, envelope, help, skill or persistent configuration is added;
there is therefore no new CLI surface for project-canon to probe. The inherited
surface and its eight partial rows (8,11,12,15,17,18,19,23) are unchanged.

- §§1,4,22: authenticate/select before observing; fixed `/usr/bin/dpkg-query`,
  native database, cwd and clean environment prevent ambient PATH/DPKG/loader
  redirection. Strict bounded tabular decoding rejects malformed, duplicate or
  incomplete records. Native diagnostics never enter results. Tests distinguish
  exact match, security-update drift, missing/wrong-architecture, broken and
  unconfigured packages from unavailable reads, even with plausible partial
  stdout. No runtime role imports host authority.
- §§2–3,5–10,13–18: no new command contract; existing result codes are reused.
  This library is **not wired into host check/apply readiness**. An exact native
  package-database match proves neither installed-file integrity nor complete
  licensed closure or mapped-user production startup. No row is promoted.
- §§11–12: query is read-only, output-bounded and deadline-limited, honors caller
  cancellation, invokes no solver and cannot install/hold/downgrade packages.
  It is not an executor, operation lock or install-retry protocol.
- §§19–21: no clock provenance, editable store or bootstrap. §§23–24: synthetic
  locks/fixtures and neutral native Ubuntu paths; closure and profile
  delivery remain unfinished product work, not an external blocker.

`TestReleaseNativePackageQuery` exercises the real dpkg-query/database with
poisoned ambient PATH/DPKG variables, natively and as root in the networkless
Ubuntu container. Other cases inject synthetic output/errors; cancellation is
an injected query boundary, not a timed native hang/signal test. Existing root
staging/distinct-UID tests still cover their own narrower archive boundaries.

Rebuilt-binary networkless Ubuntu probes with project-canon **0.9.4** completed:
doctor **7 ok / 2 warn / 0 fail / 20 skipped**; review **10 mechanical gaps /
9 manual checks / 4 passes / 6 n/a**. The inherited nested-`data`, unsupported
doctor positional and Rust-layout probe limitations still apply. No staged
filing command was executed. These probes cover the unchanged operator surface,
not an independent installer or runtime closure.

The independent release-integrity review found dpkg can return matching update
records without its base database. `0128d4ce` now requires readable regular
nonempty non-symlink base metadata before/after query and rejects normal
replacement/change. Native synthetic admin-directory tests reproduce missing/
empty base plus matching updates, valid base+updates and special-file refusal.
`e29de70f` accepts unrelated arch-less/non-policy native metadata without letting
it satisfy a valid lock, and scopes the native amd64 test explicitly. All final
focused and rebuilt canon probes above were rerun at `0128d4ce`.

## Host prepare part 4 — bounded maintenance executor, not boot readiness

Canon **v4**, §§1–24 scoped to preparation/maintenance streams. Q1–Q5 apply;
Q6–Q8 add no human-editable record store, bootstrap command or large results.
This supersedes the earlier preparation **always-refuse** descriptions, not the
whole-CLI matrix. All eight inherited partial sections (8,11,12,15,17,18,19,23)
remain partial for the whole surface; no full conformance claim is made.

| Sections | Current scoped evidence and limits |
| --- | --- |
| 1–4 | Existing strict flags/root trust checks remain. New typed `home_mount_required`, `quota_enforcement_required`, `stale_plan` and recovery refusals; protected values/native diagnostics are omitted. Native and actual-root tests cover parser, refusal and no-write previews. |
| 5–7,9–10 | Deliberate prepare domain operation; explicit site/approval/output, no prompts or TTY branching. Bounded versioned plan/result; live form only JSONL, dry-run single JSON. Fixed-FD writer is a private process helper, not a path API or operator command. |
| 8,18 | **Partial**: site-only config selection and inherited whole-doctor gaps unchanged. Kernel quota flags and a completed preparation never satisfy boot gates or apply. |
| 11 | Executable no-write preview lists quota probe and policy files; approved fingerprint revalidated under the shared lock. Same-boot/mount/site verified evidence plus exact policies yields a no-write/no-probe rerun with a fresh plan. `TestPrepareApprovalAndNoWrite`, `TestPrepareRevalidatesApprovalUnderLock`, busy/unsafe-policy/fence regressions cover this narrower local convergence. Incomplete operations stay fenced, not automatically resumed. Existing apply and other write gaps remain **partial**. |
| 12 | Ordered preflight/probe/policy progress plus one terminal event; operation show reads durable phases. SIGINT/SIGTERM mappings remain 130/143; cancellation diagnostics no longer claim nothing was written. Callback cancellation/failure tests are not actual subprocess signal/power-loss acceptance. Whole section stays **partial**. |
| 13–14 | Fixed-size inline results include policy targets and unavailable future acceptance; updated drill-down help. No pagination/export is needed for these bounded results. |
| 15–17 | Embedded operator skill describes v2 approvals, successful maintenance, fresh-plan no-op and unavailable activation/boot acceptance. Existing catalog-wide/drift limitations remain **partial**. |
| 19–21 | Existing journal clock seam remains injected; no frozen-time provenance override is added (§19 **partial**). Machine-owned phase/probe evidence is not a human record editor or general scaffold command; §§20–21 n/a. |
| 22–24 | Host library owns deliberate root mutation, CLI parses/renders; runtime roles gain no authority. Synthetic values and neutral fixed product paths. Boot gates and restart/reboot acceptance are local unfinished work, not an external permission/dependency blocker. Repository-wide §23 audit remains **partial**. |

Rebuilt-binary project-canon probes run read-only in a disposable networkless
Ubuntu container, without real homes/credentials. They remain advisory: nested
`data`, unsupported positional doctor `.` and Rust-layout assumptions require
manual interpretation. They do not exercise quota mutations or boot acceptance.
No staged issue command is executed. Native VM CLI proof is separate from these
mechanical observations and never promotes host check/plan/apply readiness.

At implementation `47d0f636`, project-canon **0.9.4** completed: doctor **7 ok /
2 warn / 0 fail / 20 skipped**; sandboxed rebuilt-binary review **10 mechanical
gaps / 9 manual / 4 pass / 6 n/a**. No staged commands were executed. The same
nested-data, doctor positional and Rust-layout limitations apply.

Independent review corrections at `e13baf72`: the operator now embeds the shipped
proc/drop-in/tmpfiles assets rather than maintaining divergent literals; explicit
0644 policy modes are set despite umask and bound in approved observations.
No-op verifies modes as well as bytes. A single tmpfiles filename avoids duplicate
runtime-directory declarations. Terminal failures report the operation phase,
not a no-write implication. Focused/root/race/contract/package and rebuilt canon
checks were rerun; doctor/review counts and inherited partials are unchanged.

## Core-runtime build — development tooling

Canon **v4**, §§1–24, scoped to the build-only `runtime-release` helper and
existing host authentication/staging library; **no installed host command,
daemon authority or readiness claim is added**. Earlier whole-product matrix
and its eight partial sections remain unchanged.

- §§1–4,9–10,22: the pinned version/digest are explicit and separate from the
  bundle; releases are unsigned and the helper takes no key. Strict pinned wire fields, complete file/component/lock/licence
  references, bounded manifests/archives and safe modes precede extraction.
  Target/digest failures remain fixed library errors. The helper emits
  versioned JSON data/errors without prompting; it does not inherit native
  diagnostics on a privileged service path. Key creation is explicitly test-only.
- §§5–8,13: file-based build inputs/output, no network solver at verification or
  staging. The checked-in Ubuntu lock separates carried platform library bytes
  from exact tool-package policy; no security downgrade or hold is implemented.
  These are explicit invocation inputs, not a new persistent config subsystem.
- §§11–12 remain **partial for this build helper**: manifest output refuses
  overwrite, verification is read-only and stage owns a fresh private scratch
  child with failure cleanup. There is no helper dry-run, durable idempotency,
  signal/event stream or installation/convergence executor. Build/native tool
  progress is developer output, not product JSONL service diagnostics.
- §§14–18: the internal helper has ordinary per-command flag help, not a complete
  canon structured-help/version/skill/doctor surface; **no conformance pass is
  claimed for this developer tool**. It still uses coarse failure exit 1 and
  ordinary flag-parser diagnostics, rather than the product's complete classified
  error/help contract. Independently provision/audit its binary and trust inputs
  before root use. It is not shipped as the product host CLI.
- §§19–21: no timestamps, human record store or implicit bootstrap. Stable core
  archives are built from sorted files/zero tar times; the private stage name is
  intentionally random. The metadata digest names exact bytes,
  not an assertion of production qualification.
- §§23–24: neutral manifests/paths, retained upstream notices (not a blanket
  licence grant), no private home/config/provider state or asserted external
  blocker. Optional and expanded profiles remain unimplemented scope.

`TestReleaseClosureInventory`, `TestReleaseClosureNPMLock` and
`TestReleaseClosureDebLock` cover missing/extra members, changed digests/modes,
licence-reference omissions and lock disagreement. The actual-root suite covers
staging/UID denials; the fresh offline QEMU check separately traverses production
`ServeHTTP` → `pi.validate` as mapped users with minimal HOME/PATH. That is
runtime startup evidence, not a conversation/provider, quota, boot-gate or
customer apply/upgrade acceptance. Ordinary product packaging stays checksum-only;
only the manifest-pinned core archive has the new authentication inventory.

### Runtime-only installation

`runtime-release install` extends the helper to deliberate root-only publication
for manually installed hosts. `--select core`, exact version/digest and an
explicit closure directory select the operation; `--prefix` defaults to the
standard runtime prefix and exists for disposable qualification. There is no
new service or unprivileged authority. Host operation locking and journal guards
prevent bypassing host apply/upgrade.

§§1,11,12,22: installation shares authenticated staging, generation publication,
link writers and Pi-selector serialization with host maintenance. Retries verify
archives and existing payload bytes. Failed selection reobserves and restores
both outputs, including post-rename failures; failed recovery is explicit.
SIGINT/SIGTERM cancel staging cooperatively. `--dry-run` explicitly refuses;
`verify` is the read-only closure check, not an activation plan. The helper's
existing JSON-only output, coarse exit code and ordinary flag help remain
partial, not a full canon-conformance claim. It does not establish installed-host
readiness, install packages or start services. Focused runtime-install tests cover
retry, corrupt archives/generations, interrupted journals, unsafe selectors and
post-rename failure recovery in disposable prefixes.

## Host preparation part 5 — read-only storage boot boundary

Canon **v4**, §§1–24, scoped to installed startup policy and preparation's
expanded policy list. No public command/flag/result schema was added. The private
fixed-argv `boot-storage-check` helper is a service precondition, not a configurable
maintenance interface; it accepts no target path or identity and has no writes.
All eight inherited partial sections **8,11,12,15,17,18,19,23** remain partial.

- §§1–4,9–10,22: the helper reads only root-trusted bounded installed policy and
  fresh storage predicates, returns fixed JSON diagnostics without native errors,
  and refuses missing/wrong storage or unenforced quotas. Runtime observation is
  separate from maintenance authority. Root-container policy tests cover writable
  parents/files, links and foreign owners; native tests reject ambiguous policy
  encodings. Existing operator parsing/envelopes/exits remain unchanged.
- §§5–8,13–18: no new operator configuration precedence, doctor, help tree,
  personal resource or export format. The embedded operator skill now separates
  storage ordering from unimplemented binding/ACL/session acceptance. The fixed
  policy path cannot be overridden by ambient environment or operator flags.
- §§11–12: prepare's existing approved-plan/atomic-publication/no-op behavior
  covers the additional policy files. Installation alone does not reload/enable
  units, restart logind/polkit, restore per-user ACLs or prove apply readiness.
  A non-retained oneshot rechecks each new activation transaction; it is not
  continuous monitoring of already active services following root changes.
- §§19–21: no clock, new persistent readiness store, editable record format or
  bootstrap authority is introduced. §§23–24: neutral fixture names/paths, no
  installation-tooling code or live service mutation, and honest partial acceptance.

Rebuilt-binary read-only probes in a disposable networkless Ubuntu container,
with a fictional native user and no real home/credentials mounted, completed
with project-canon **0.9.4**: doctor **7 ok / 2 warn / 0 fail / 20 skipped**;
review **10 mechanical gaps / 9 manual / 4 pass / 6 n/a**. The previously named
nested-data, unsupported doctor positional and Rust-layout assumptions remain.
No staged filing command was run. These advisory probes do not test boot
ordering; native VM evidence and its deliberately narrower scope belong in the
preparation result, not a promotion of the CLI's partial rows.


The part-5 final review also exposed a whole-host missing-group startup hazard:
Ubuntu's conditional sysusers unit need not replay a newly installed declaration.
Approved preparation now establishes the single empty product exemption group
before publishing any proc/session policy that names it. The preview lists this
action, group observation participates in under-lock approval, and no-change
rechecks its existence. Existing direct/primary members and GID aliases refuse; no broker user, binding
or membership edit is introduced. Native disposable-root getent/sysusers and
production CLI VM checks, rather than a fixture's manual sysusers call, establish
that narrower prerequisite. No service restart/session readiness claim is added.


## Host preparation part 6 — broker cold gates and session maintenance

Canon **v4**, §§1–24 scoped to preparation and installed startup policy. Q1–Q5
apply; Q6–Q8 add no editable records, general bootstrap or large results. The
eight inherited whole-CLI partials **8,11,12,15,17,18,19,23** remain unchanged.

- §§1–4,9–10: the fixed root-only binding helper accepts only a validated unit
  instance name and uses the broker's strict locked ledger/config parser. Pending,
  staging, revoked, unbound and foreign state refuses before cold reconstruction.
  Diagnostics contain fixed reasons, not request/native error text. The public
  CLI adds typed `session_policy_unavailable`, not an identity-selection API.
- §§5–8,13–18: existing prepare flags, bounded results and explicit JSONL form
  remain. Help and the embedded operator skill describe the disruptive restarts
  and `host.prepare.v4` approvals. No personal configuration/doctor/catalog
  improvements or large-output interface is introduced; inherited partials stay.
- §§11–12: approved preparation journals session restart intent after exact policy
  publication, reloads systemd, enables/restarts proc policy and restarts logind/
  polkit. It verifies the effective single proc mount and running service groups.
  Same-boot/mount no-op requires those live facts as well as policy and EDQUOT
  evidence. Interruption leaves an incomplete fence, not automatic replay.
  Synthetic phase tests are not native signal/power-loss acceptance.
- §§19–22: the existing injected journal clock remains; no second identity,
  linger, user-manager or readiness store is created. Reconstruction lives only
  in provisioning, not the operator or read-only storage guard. Existing runtime
  roles acquire no maintenance authority. Neither prepare nor a gate certifies
  host apply/runtime/profile readiness.
- §§23–24: neutral unit paths and synthetic fixtures; native completion is
  recorded separately in the preparation result. The storage unit contract is
  unchanged. Both listener templates additionally require a non-retained native
  broker binding gate; it replaces the external Python activation contract.
  New boot gates deliberately disable service default dependencies to avoid
  the basic.target → sockets.target ordering cycle. Re-checksummed hostile gate
  commands, cached success and removed ordered dependencies must fail packaging.

Read-only rebuilt-binary project-canon doctor/review runs remain advisory and do
not exercise root maintenance or boot behavior. The nested-data, unsupported
doctor positional argument and Rust-layout probe limitations still apply.
No generated issue command is executed; no inherited partial is promoted.

At committed source `73fd7e81`, project-canon **0.9.4** completed in the
rebuilt-binary disposable sandbox: doctor **7 ok / 2 warn / 0 fail / 20 skipped**;
review **10 mechanical gaps / 9 manual / 4 pass / 6 n/a**. No staged command
was executed. Separate native acceptance passed five binding/session cold boots
and four storage cold boots; those prove their stated host boundaries, not full
CLI conformance or host apply readiness.



## Optional runtime archives — development tooling, not host installation

Canon **v4**, §§1–24, scoped to the existing development signer/verifier and
profile build/qualification fixtures. No installed product CLI, daemon authority,
provider config writer or host readiness condition is added. The eight inherited
whole-product partials remain unchanged.

- §§1–4,9–10,22: explicit descriptor-array input; every profile requires a complete
  closure before the manifest is written, and verify/stage cover every advertised archive. Native
  component kind supports the upstream editor/uv trees; optional npm and Debian
  components cannot bypass native-lock cross-checks. Fixed host errors retain
  redaction. Build-time Python/native-tool failures remain developer diagnostics,
  not production service logs or canon-complete classified errors.
- §§5–8,13: exact source URLs/digests and package versions, no install-time solver,
  no personal settings or source checkout requirement for verification. Large
  inventories stay in digest-pinned files. No persistent product config surface changes.
- §§11–12 remain **partial for the developer helpers**: new output directories
  and the exclusive manifest write refuses clobber; staging remains
  private with cleanup. No dry-run, durable build retry, streaming protocol or
  process-signal contract is claimed. This is not apply/upgrade execution.
- §§14–18 retain the previously documented helper gaps: ordinary flag help,
  coarse exit 1, no complete structured-help/version/skill/doctor interface.
  Product mechanical canon probes do not promote the build helper to a pass.
- §§19–21: sorted component/file inventories and zero archive times preserve
  deterministic sealing; keys/stage names remain random. No new clock, editable
  record store or implicit bootstrap. §§23–24: neutral fixtures, retained native
  notices plus uv source closure, no credentials, invented licence grant or
  asserted external blocker for unfinished profile work.

Fresh-VM per-profile workflows are empirical acceptance for those exact archives,
not a claim that every candidate profile or the complete customer toolchain is
qualified. A buildable lock is not advertised by default. Unverified licence or
workflow candidates must remain outside the delivered manifest, with typed
obstacles in release evidence. Existing core qualification, boot-policy and
installer/executor evidence retain their separate scopes.


The independent profile review tightened acceptance further: exact manifest/source
commit binding, bounded/serialized VM admission, kernel `memory.max` readback
inside a native per-UID user-manager container, actual font-family matching, and
per-profile dependency simulation with an empty repository index before union
installation. These are developer qualification safeguards, not new product
commands, a host installer, resource delegation by a daemon, or a conformance
promotion. Resource/capacity refusal still leaves qualification incomplete.


Part D's expanded-profile proof accepted seven optional profiles under both mapped
UIDs in a fresh, separately pinned security-matched Ubuntu 24.04 guest. This is
not full installation/upgrade acceptance or qualification of the complete customer
toolchain. Its containers were withheld after native netns cleanup errors despite successful
port/volume/kernel-limit probes. Python 3.14 was subsequently qualified separately,
and the later container profile proves repeated cleanup and pause-replacement
recovery. Full coding, Bun, browser assets and integrations remain unavailable. No
provider entitlement or full local-Moodle workflow is inferred.

The real old-OS apt failure also tightened the boundary: libc/systemd/udev suites
are platform evidence, never exact tool pins or partial replacements. Complete
lockstep GLib application-library companions preserve OS reverse dependencies.
Both offline preflight and installation refuse removals as well as downloads and
unsafe downgrades. A rejected candidate cannot emit whole-bundle PASS. The
corrected document/font closure passed the real final guest; this empirical
result does not promote the developer helpers' existing canon partials. Canon
probes completed with the already documented 7/2/0/20 doctor and 10/9/4/6 review
counts/limitations. No generated intake command was executed.

The container profile adds an authenticated service-internal namespace initializer,
not a new host operator command or delegation authority. It has plain diagnostic
errors and no help/JSON/dry-run interface; it is not canon-complete. Its digest-pinned
provider and native qualification do not promote these developer/internal helper
partials or establish optional-profile activation or customer Moodle acceptance.

## Named-release upgrade batch

`host upgrade` uses the shared strict maintenance parser, single-document dry
run and versioned JSONL live stream with cancellation and durable operation
inspection (§§1–4, 10–12, 14). Maintenance and interruption have separate explicit
approvals. `TestHostUpgradeExplicitApprovalAndStrictFlags` covers their boundary;
`TestUpgrade*` covers read-only previews, stale/foreign approvals, stage-before-
maintenance, immutable owner, closed failure boundaries and matching continuation.
Upgrade operation schema 2 names its owning generation. No new config precedence,
interactive prompt, arbitrary root hook or native identity registry is introduced.
Inherited partial rows above remain partial. Mechanical canon evidence belongs
in the delivery receipt, not a claim of whole-CLI conformance here.

Isolated core upgrade acceptance also exercised production mapped-UID startup,
actual executable adoption, fenced dead-lease reboot, accepted-state recovery
and healthy successor cold boot. Final mechanical doctor had no failures;
advisory review retains 10 inherited gaps (8 must, 2 should) and 9 manual rows.
This does not promote inherited partial rows to whole-CLI conformance.

## Admin onboarding batch

`admin onboarding show` and `admin onboarding update --file <path|->
--expected-version <n> [--dry-run]` read and replace the site onboarding
configuration over root's gateway control socket, through the same writer
and validation as the browser (§§1, 7). Input is one strict JSON document from
a file or stdin, and a `show` reply, enveloped or not, can be edited and
written back; its version must equal `--expected-version` (§§4, 6). A newer
stored version is the typed `version_conflict` (exit 1), and every gateway
rejection is the same fixed code the browser receives (§§9–10). `--dry-run` has
the gateway check the document and version without writing and reports
`known_effects` (previous, next, changed parts, who it affects) with
`version_at_commit` unknown until apply (§11). Drill-down help lists both
flags (§14), and the operator skill says how to edit the record (§16).
`TestAdminOnboarding*` covers round trips through the real control handler,
dry-run without writes, stale versions, rejections and strict flags; gateway
`TestOnboarding*` proves browser and control reject identically. Mechanical
review of the built binary reports the same 10 inherited gaps (8 must,
2 should) and 9 manual rows as before; none is new here.

## Admin ai-key batch

`admin ai-key show`, `admin ai-key copies`, `admin ai-key set --provider
openai|anthropic|deepseek --key-file <path|-> [--dry-run]`, `admin ai-key
delete --offer <offer> [--dry-run]` and `admin ai-key seed --github-id <id>
[--dry-run]` go over root's gateway control socket to the same writer the
browser administrator uses, with actor `root` (§§1, 7). The key is read from a
file or stdin, never argv, and is checked locally with the gateway's own
literal-key rule before anything is sent; no output, refusal or log line
carries it, and replies name only provider, suffix and set_at (§§4, 6, 9).
`set` makes the offer `site_key` in the same operation and `delete` requires
the replacement offer, so the two never disagree (§7). `seed` takes only the
GitHub id; the person's own daemon decides the write under Pi's lock, and
every output says root is writing into another person's credentials (§§6, 7).
Gateway refusals are fixed codes with exit 1 (`invalid_key`, `invalid_offer`,
`site_key_unavailable`, `subject_unavailable`, `site_key_busy`), and `admin
onboarding update` refuses to move the offer with `site_key_stored` (§§9–10).
A seed whose daemon was not reached is `not_reached` and one that was not
answered is `outcome_uncertain`, both exit 2 and never a success (§10).
`--dry-run` has the gateway run the same checks without writing and reports
the current key, the resulting offer and who the change affects: for `set`
whose copies it replaces, for `delete` who keeps one, and for `seed` the
person's daemon's one-word check as the exact effect, with the decision under
Pi's lock unknown until apply (§11). A `set` reports each replaced copy's
outcome. The control exchange for `seed` and `set` has a longer deadline than
other admin operations, since they wait for native Pi in people's daemons.
Drill-down help lists every flag and the offer values (§14); the operator
skill says who pays, that copies cannot be recalled and that seeding writes
into another person's credentials (§16). `TestAdminAIKeyCommands` runs the
commands through the real control handler, including stdin and file keys, dry
runs that write nothing, refusals that never echo the key and strict flags;
`TestAdminAIKeySeed` covers seed's request, effects, outcomes and exit codes,
and gateway `TestSiteKeySeedControl` the control operations against fake
daemons.

## Admin integrations batch

`admin integrations list`, `admin integrations set --provider P --client-id ID
(--client-secret-file <path|-> | --tenant-id ID) [--dry-run]` and `admin
integrations clear --provider P [--dry-run]` go over root's gateway control
socket to the same broker write the browser administrator uses, with actor
`root` (§§1, 7). The secret is read from a file or stdin, never argv, and no
output, refusal or log line echoes it or any rejected value (§§4, 9). Each
provider takes exactly its fields, checked locally with the broker's own rule
before anything is sent (§6). Broker refusals are fixed codes with exit 1
(`browser_setup_disabled`, `host_busy`, `integrations_file_invalid`,
`integration_refused`); an unconfirmed reply is `outcome_uncertain` (exit 2),
never a success, and nothing retries it (§§9–10). `--dry-run` reads the list
and reports `known_effects` (current section, set/replace/remove effect) with
the host lock and file at commit unknown; with root's switch off it refuses as
the write would (§11). Drill-down help lists every flag, the provider values
and which fields each provider takes (§14); the operator skill says who owns
which part of the file (§16). `TestAdminIntegrationsCommands` runs the
commands through the real control handler and the gateway adapter's
classification, including stdin secrets, dry runs that send nothing, every
refusal, both uncertain paths and strict flags.

## Gitea credential helper — Git protocol exception

`gitea git-credential [--login NAME] get|store|erase` is Git's credential-helper
protocol, not the canon's resource surface. Git runs it as the URL-scoped
helper `nativegitea.GitConfig.Register` writes, appends the operation and
reads `key=value` lines from stdout. That external contract overrides these
sections, and only for this leaf:

| § | Status | Evidence and limits |
|---|---|---|
| 1 | pass | Exactly one operation from get/store/erase and an optional non-empty `--login`; extra or unknown arguments exit 1 before stdin is read. The stdin request is bounded (64 KiB, 8 KiB lines); a repeated core attribute, NUL, a missing `=` or a `url=` restatement is refused (`TestParseCredentialRequest`, `TestGiteaCredentialCommandSurface`). |
| 2, 4 | exception | Exit 0 with a credential, or with no output when no unique login matches (Git's ordinary "no answer"; ambiguity adds one fixed stderr line). Exit 1 for malformed arguments or request, 2 when tea's file is unavailable. Stderr carries fixed codes only, never a path, native error or token. |
| 3 | pass | Never prompts or reads a terminal; Git's prompt is its own (disabled in managed transfers). |
| 5, 9 | exception | Stdout is the Git protocol, not JSON: `get` prints only `username=` and `password=`, and only for a request that matches exactly one usable tea PAT login. Global `--json` does not change it. `store` and `erase` drain stdin and print nothing. |
| 6, 7 | exception | get/store/erase are Git's verbs. This is not a general secret-export command: there is no way to name a token, only a Git request to match. Connect, replacement and removal are nativegitea library operations for the daemon, not CLI verbs. |
| 8 | pass | No configuration of its own: paths are tea's selection from `$HOME`/`$XDG_CONFIG_HOME` in Git's environment, the same environment Git used to find the helper. |
| 11 | pass | `store`/`erase` are no-ops, so no second credential copy exists; the helper never writes tea's file (`TestGiteaCredentialHelperThroughGit` runs real `git credential fill/approve/reject` in a disposable HOME with global store helpers before and after ours and finds no copy). |
| 14 | pass | `gitea git-credential --help` drills down with the operation argument and `--login`; `TestHelpDrilldownAndAgentSkill` walks it. |

No secret enters argv: Git passes the request on stdin and the token stays in
tea's file. The helper calls no daemon or gateway and keeps no state.
`project-canon review` was not rerun for this leaf; the rows above are source
and test judgment.

## GitLab credential helper — Git protocol exception

`gitlab git-credential get|store|erase` is the same Git-protocol exception as
the Gitea leaf above, for glab's file instead of tea's; the rows above apply
with these differences:

| § | Status | Evidence and limits |
|---|---|---|
| 1 | pass | Exactly one operation from get/store/erase; there is no `--login`, because glab keeps one account per server. Extra or unknown arguments exit 1 before stdin is read; the request bounds are the shared parser's (`TestGitLabCredentialCommandSurface`). |
| 2, 4 | exception | Exit 0 with a credential, or with no output when no usable entry matches; a server glab's file names twice adds one fixed stderr line. Exit 2 when glab's file is unavailable. |
| 5, 9 | exception | `get` prints only `username=` and `password=`, and only for HTTPS to the exact host and port of a usable glab token entry, a project path (2–21 GitLab path segments, never `/-/` or below a repository) under its base, and its own username when Git names one. |
| 8 | pass | Paths are glab's selection from `$HOME`/`$XDG_CONFIG_HOME`; `GLAB_CONFIG_DIR` is not followed, so the helper answers only from the file the daemon writes. `GITLAB_TOKEN` and the keyring are never read. |
| 11 | pass | `store`/`erase` are no-ops (`TestGitLabCredentialHelperClonesAndPushesNestedProjects` clones and pushes a nested group project through real Git with a global store helper and finds no copy). |
| 14 | pass | `gitlab git-credential --help` drills down with the operation argument. |

## Admin access batch

`admin access list [--state allowed|joined|withdrawn]`, `admin access lookup
--login <login>`, `admin access add --github-id <id> [--dry-run]` and
`admin access remove --github-id <id> [--dry-run]` go over root's gateway
control socket to the same withdrawal and restore sequence the browser uses
(§§1, 7). `add` and `remove` take only the canonical numeric id; a login is
resolved separately by the read-only `lookup`, so the id being admitted is
always explicit (§§4, 6). `remove` on a site.json id is a usage error naming
site.json as the owner (exit 1). Every broker or GitHub refusal is a fixed
code with exit 1 (`runtime_admission_disabled`, `runtime_admission_full`,
`admission_open`, `binding_drift`, `github_user_not_found`,
`github_not_user`); an unconfirmed broker reply is `outcome_uncertain` and an
unreachable GitHub is `github_lookup_unavailable`, both exit 2, never an
empty result or a success, and nothing retries them (§§9–10). `--dry-run`
reads the current list and reports `known_effects` (current entry, effect,
`restore_to` with the bound username, ended sessions) and what stays unknown
until commit; with the switch off it refuses as the write would (§11).
Drill-down help lists every flag and its values (§14); the operator skill says
how the two admission sources relate (§16). `TestAdminAccessCommands` runs the
commands through the real control handler, including dry runs that write
nothing, refusals, the uncertain exit and strict flags;
`TestAccessWriteClassification` pins which broker replies are uncertain.

## Agent view batch

`agent view offer --workspace <ws_> --source <path> [--entry-file <html>]
[--title <text>] [--conversation pi:UUID | --current] --idempotency-key <UUID>
[--dry-run]`, `agent view list [--output FILE.jsonl]` and `agent view remove
--view <id> [--dry-run]` go to the own-UID agent listener (§§1, 6–7). Flags are
strict per verb, the workspace and view are explicit IDs and the source is
workspace-relative; the daemon refuses traversal, symlinks and special files
with fixed codes (§§4, 9–10). An offer with the same key and request recovers
the same view without a second export or notice, and a different request is
`idempotency_conflict` (§11). `--dry-run` reports what would be exported
(files, bytes, skipped hidden entries) and writes nothing. The reply and
warnings say the offer was published, never that anyone saw it, and name a
nonpersistent conversation card (§§10, 12). Lists export to a new JSONL file
(§13); help and the agent skill carry the workflow (§§14, 16). Daemon
`TestViewOffer*`/`TestViewExport*` and gateway `TestView*` cover the boundary.

## Agent settings batch — code hosts, dictation key, recap settings

`agent code-host create --provider gitea|gitlab --base-url URL --secret-file
FILE|-`, `code-host update|check|repair|delete --connection ID`, `agent
speech-key show|update|delete` and `agent recap-settings show|update
--input-file FILE|-` go to the own-UID agent listener, which serves the
browser's own daemon handlers at agent paths (§§6, 22): tea's, glab's,
Soniox's key file and Pi's settings stay the only stores, and the browser and
agent share one write lock per store. The connection ID names its provider,
so no second flag can disagree with it (§1). Tokens and keys are read only
from a protected file or redirected stdin, bounded, refused rather than
trimmed beyond one line ending, and never echoed in errors or replies
(§§1, 4, 8). `check` is a verb of its own because it asks the server and
writes nothing; `repair` re-registers Git's helper; both are native
operations, not status patches (§7). Writes refuse `--dry-run` as
`dry_run_unsupported` before reading input (§11, partial as above: a lost
reply is inspected with `integration list`, never replayed). The dictation
session mint stays browser-only. Help and the agent skill describe all ten
leaves (§§14, 16). `TestCodeHostProtectedToken`, `TestSettingCommands`,
`TestAgentGiteaConnectionIsTheBrowsers` and `TestAgentSpeechKeyIsTheBrowsers`
cover the parser and the shared-handler boundary. `project-canon review
--profile cli --run` (0.9.4, networkless container, fictional user) reported
only the inherited advisory rows above.
