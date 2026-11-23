# Operator skill fact-check

Checked `internal/cli/operator/SKILL.md` after rewrite `c3465756c`, against the
source at `061843ca9` (the worker's main baseline), installed help, and the
referenced operator guide and site schema. The task explicitly chooses main
as the shipped text's authority where the installed release differs. Only the
operator skill and this issue were changed; no neighboring instruction file
or CLI behavior was changed.

The issue was filed through `issuectl intake file`, unlaned, with the exact
originating run, then closed after verification. This follows the generated
run policy rather than the brief's superseded `issuectl create` recipe.

## Corrections and evidence

| Correction | Evidence |
| --- | --- |
| A session-policy service restart can disrupt work; it does not necessarily end everyone's work. | `internal/host/prepare_session_linux.go:restartSessionPolicy` restarts proc, logind and polkit, not every user's services/processes. The original universal claim was stronger than the action. |
| Help supplies flags/examples, not a complete catalog of refusals on every command. A structured blocked qualification is not every failed read. | Installed and source-built help; `internal/cli/help.go`, `host_linux.go:hostBlocked` and `hostErrorBase`. Qualification refusals carry `error.result.data`; ordinary trust, I/O and syntax failures need not. |
| Same-original-approval recovery has two implemented exceptions: verified prepare at `session_restarting`, and pre-publication apply. Both use fresh preview approval. The late-apply paragraph no longer claims every earlier phase is unrecoverable. | `prepare_continue_linux.go`, `prepare_execute_linux.go`, `apply_execute_linux.go:executeApply`, `apply_prepublication_linux_test.go`; guide sections “Continuing a preparation stopped at session restart” and “Continuing an apply stopped before publication”. No general reset/bypass was added. |
| A no-change generation apply still checks/installs Chrome afterwards. Chrome failure occurs after entries reopen, not behind the maintenance fence; retry uses a fresh apply plan. Late corrected-binary recovery does not rerun runtime-package installation, but is subject to this post-step. | `apply_native_linux.go:applyNative`, `upgrade_native_linux.go:upgradeNative`, `server_browser_linux.go:requireServerBrowser`, `internal/cli/host_linux.go` mapping of `ErrServerBrowser`. |
| Ubuntu 24.04 supports amd64 **and arm64**. Storage can explicitly omit per-user quotas and use the filesystem containing `/home`, including root. | `internal/host/platform.go`, `site.go:Storage/Validate`, `storage_linux.go`, `site/schema.json`; guide “Supported fresh installation”. The added shared-disk warning is the consequence of having no enforced per-user limit, not a new quota mechanism. |
| Nonzero default quota, EDQUOT probe and quota-default convergence apply only in quota mode. The default-limit field must be absent in no-quota mode. | `site.go:Validate`, `prepare_linux.go:BuildPreparePlan`, `prepare_execute_linux.go`, `prepare_linux_test.go` no-quota case, `apply_control_linux.go` conditional quota convergence. |
| Runtime verifier **results** are JSON; help is text. | Built `cmd/runtime-release`, ran `verify --help`; `main.go` uses Go flag help while emitting JSON verification/error results. |
| Missing runtime-profile inputs block installation; missing provider app credentials make that provider unavailable, not the whole host. | `apply_native_linux.go:loadRelease` requires integration tools; `integrations_linux.go:integrationsPolicy` permits an absent config and generates tools; `internal/daemon/integrations/catalog_linux.go:UnavailableReason` returns `app_credentials_required`. `site.go` declares runtime profiles and browser setup, not provider app secrets. |
| Google Chrome is an exception to “the binary does not update indexes”: its post-transition apt step adds/uses Google's repository and refreshes only that index. | `server_browser_linux.go:installServerBrowser` explicitly runs apt update with SourceList and SourceParts overrides. Ubuntu source indexes remain the operator's responsibility. |
| Removing an operator admission does not revoke someone another admission source still admits. | `apply_control_linux.go:converge` checks `state.RuntimeAdmits(id)` before revocation; broker `withdrawal_linux.go:keepRevoked` checks the union of sources. |
| Upgrade interruption applies to product daemons, not the person's user-manager services. SSH, tmux and those services survive. | `upgrade_native_linux.go:quiesce` stops only product system units; `upgrade_linux_test.go:TestUpgradeInterruptionFollowsDaemonsOnly` explicitly verifies user-unit inventory does not require interruption approval. |
| The blanket assertion that apply never sets admin state was false: site admission, declared administrator roles and quota default are its portion. | `apply_control_linux.go:converge`; the original skill already described those writes in the apply section. |
| Admission has three sources, including browser-managed GitHub teams. The runtime-admission switch gates additions/new members, not withdrawal. | `internal/provision/admission_runtime_linux.go` handles `admit`, `withdraw`, team add/remove and `signIn`; only additions/new membership check `RuntimeAdmission`. `internal/cli/help.go` access-list description names the three sources. |
| Withdrawal also stops the product daemon, its Pi conversations and sockets; only account/files/SSH/user-manager work remain. | `internal/provision/withdrawal_linux.go:stopRevoked`, `listenerUnits`, `LinuxHostExecutor.StopListeners`, and withdrawal tests. This is not permanent account removal. |
| `openssl s_client` validates the peer but does not directly print all the promised certificate fields. Inspect its certificate with `openssl x509 -serial -dates -ext subjectAltName`; close stdin for the noninteractive probe. | Installed `openssl s_client -help` and `openssl x509 -help`. No production TLS endpoint was contacted. |

## Other claims checked

- **Embedding, version and references:** `internal/cli/personal_linux.go` embeds
  the file; `cli.go:operatorSkillContent` substitutes the build version;
  `scripts/package-release.sh` prints it into `operator/SKILL.md` and ships
  the site schema/example and runtime verifier. The public repository exists.
  Local tag `v0.1.6` contains `docs/operations.md`. The guide contains the named
  recovery and Google/Microsoft/Dropbox registration sections. This skill
  points to no other companion skill.
- **Read/stream contracts:** `internal/cli/host_linux.go`, host apply/prepare/
  upgrade handlers and tests, and `internal/host/inspect_linux.go`,
  `apply_execute_linux.go`, `prepare_execute_linux.go`, `upgrade_linux.go`
  distinguish read-only previews, operation-lock execution, approval matching,
  terminal events and signal exit statuses. No live maintenance was run.
- **Input/release trust:** `operation_linux.go:LoadSite/readPrivateAtLimit`,
  `inspect_linux.go:observeReference`, `apply_native_linux.go:inputBindingProduct`,
  `release.go:AuthenticateRelease/Select`, release closure/staging code and the
  runtime verifier substantiate trusted ancestry, private single-link files,
  metadata-bound secret inputs, digest-before-parse, archive inventories,
  fixed release directory and manifest/profile verification. Root-owned 0600
  remains the recommended delivery mode (the reader actually accepts other
  owner-only modes too). Nothing from the bundle authorizes its own digest.
- **Installation security:** `site.go` and its schema tests cover numeric ids,
  core/integrations profiles, immutable storage/identity and editor hostname
  expansion. `apply_secret_parent_linux.go`, `apply_gateway_identity_linux.go`,
  `apply_units_linux.go` and their tests cover parent ACL/modes, exclusive
  gateway identity and foreign overrides. The broker's own exact daemon-slice
  drop-in is not a foreign override. `integrations_linux.go` preserves other
  sections' value bytes while replacing tools.
- **Native readiness and recovery:** `prepare_session_linux.go` accepts exactly
  inactive/dead polkit with the configured group, but requires live logind and
  effective kernel groups for running services. `gateway_listen_linux.go` and
  `apply_units_linux.go` implement the documented port/capability/sysctl rules.
  `apply_continuation_linux.go`, continuation tests and the guide support the
  two original-approval late-phase repairs; `upgrade_linux.go` and upgrade
  authentication bind the named predecessor and immutable owner binary.
- **Administration:** admin onboarding, AI-key, access and integration handlers
  and their tests substantiate dry-run flags, stdin secrets, uncertain writes,
  whole-document/version-conflict onboarding updates, copy states and
  conditional AI-key replacement. `gateway/onboarding_plan.go` limits automatic
  key delivery to binding-creating sign-in. Broker integration writes remain
  conditional on published browser setup and the maintenance lock.
- **TLS:** `apply_native_linux.go:activate` restarts the gateway on changed
  generated configuration and starts it otherwise. The copied-secret paths
  and source-rotation sequence agree with the guide. The TLS update does not
  replace a named upgrade or mutate people's homes.

## Installed release versus main

Observed help/version without changing installed tools:

- Open Habitat `0.1.6`, commit `41c214dcba83b80a5d491cea5e649ce2a7aca9da`.
- Taskfleet `0.20.0` (`taskfleet version`; `--version` is not supported).
- Pi `1.5.2` (`pi --version`).
- issuectl `0.21.0` (`issuectl --version`).

All 31 main `host`/`admin` help leaves were exercised on a disposable source
build. The installed binary accepts 29; `admin access remove-person` and
`cancel-removal` are absent. Main added them in `f7cdf06c5`, so the skill's
reference to permanent removal remains correct for main and intentionally
was not downgraded to the installed release.

The source and installed help still contain stale descriptions outside this
file: `admin access remove` says processes stay, and `--approve-interruption`
mentions persistent service activators. The verified implementations above
are authoritative; these help strings were left untouched under the task's
file-ownership restriction. The operator skill itself invokes none of
Taskfleet's, Pi's or issuectl's commands, so their version differences require
no edits to it.

## Verification

All passed under `umask 077`, using disk-backed scratch with the shared lease:

- `./scripts/test-focused.sh --area go --go-package ./internal/cli`
- `./scripts/test-focused.sh --area go --go-package ./internal/host`
- `./scripts/test-focused.sh --area go --go-package ./cmd/runtime-release`
- Disposable builds of `cmd/open-habitat` and `cmd/runtime-release`, all 31
  source operator help leaves, and the installed-help comparison above.
- `git diff --check`.

No test pins a corrected phrase. `internal/cli/cli_test.go` checks that printing
and installing the operator skill preserve the embedded content, so no test
needed changing. Tests are source/fixture evidence, not a live installation
or distinct-user isolation qualification.

## Unchecked and decisions

No root operations, host check/plan against real private inputs, apt writes,
service restarts, credential changes, browser sign-in, provider authorization,
TLS rotation, reboot, or live recovery were performed. No released archive was
downloaded and authenticated, and no current GitHub asset digest was used as
a deployment approval. Future release tags/guide accuracy cannot be proven
from the current tag. Other integrations' external app-registration flows
were located in the guide, not reenacted.

No new product decision is needed for these factual repairs. Whether any
installation still needs the two historical late-apply repairs is knowledge
only Jari/operators hold. Keep the implemented recovery instructions until
that is known; their removal would be a separate scope/editorial decision,
not a factual correction.
