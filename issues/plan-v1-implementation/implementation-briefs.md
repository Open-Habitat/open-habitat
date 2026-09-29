# V1 implementation briefs

This package is a proposal for `review-implementation-plan`, not approval or runtime evidence. All commands marked **PROPOSED** become executable only when `build-app-foundation` implements them from a clean checkout, records them in root/local `AGENTS.md`, and proves them. Issuectl remains the only execution schedule.

## Frozen inputs

| Input | Exact source revision |
|---|---|
| Accepted UI v1 decision (`issues/review-ui-v1/review.md`) | `9732ffbd3ff0af37911b84b86f321808e482c13b` |
| Pi 0.85.1 native probe | `4187da0ec40079ec09d98539c03f840102cde616` |
| Workspace/Git/Taskfleet/GitHub boundary probe | `c1e06b0af9a2835106b5f27277dd1de31766856a` |
| Proposed ADR 0002 / frontend trial | `ffdf0e6eeb46aa44055b52569775d20956db1a01` |
| Proposed ADR 0003 / host trial | `958f974f1c9f1ac47af48b69a738bed7bfb1128b` |
| Host contract schemas, examples and CT-001–CT-029 | `311a354a3aaf222c3d9261468d379f8c0788599b` |
| Production design, catalog and static reference | `62c0ae6833301bcdd0901053ea08ef514a929153` |
| ADR 0001 | `642bd26c7f68009c8c59f284aca04f169ed97598` |

Every worker also consumes the accepted review revision produced by `review-implementation-plan`; it must record that SHA in its `result.md`. ADRs 0002 and 0003 remain Proposed until that human review.

## Proposed repository and command contract

### Bootstrap layout owned by `build-app-foundation`

```text
go.mod / go.sum
cmd/native-agent-host/  # thin AI-first operator/runtime CLI
internal/
  contracts/            # generated/validated wire types only
  core/                 # source facts, command ledger, operations, adapters
  gateway/              # OAuth/OIDC/session/CSRF, static files, UDS routing
  daemon/               # per-UID HTTP/SSE and native process ownership
web/
  package.json / package-lock.json / .node-version
  src/app/              # routes, store, connection controller
  src/components/       # production components shared with Storybook
  src/contracts/        # generated v1 types/validators
  src/test/             # redacted fixtures and browser harness
scripts/
  ci-local.sh package-release.sh verify-release.sh
systemd/ sysusers.d/ tmpfiles.d/
```

Go is locked to 1.27.1, stable TypeScript to 7.0.2 and Node to 22.23.2 unless the review records a changed pin. Generated Go/TypeScript types are derivatives; `contracts/v1/` remains authoritative. `go generate ./internal/contracts` must be deterministic, and the repository drift check must fail without rewriting.

### AI-first operator CLI

The foundation applies AI-first CLI canon v4: strict inputs, no prompts/TTY detection, global `--json`, schema-versioned stdout, structured stderr errors, JSONL service diagnostics, meaningful exits, dry-run for mutations, inspectable config/data roots and stable version provenance. Proposed public surface:

```text
native-agent-host version --json
native-agent-host config path --component gateway|daemon --json
native-agent-host config show --component gateway|daemon --json
native-agent-host doctor --component gateway|daemon --json
native-agent-host gateway exec --config <path> --verbose
native-agent-host daemon exec --config <path> --verbose
native-agent-host admin readiness show --json
native-agent-host maintenance enter --json
native-agent-host maintenance leave --json
```

`gateway exec`/`daemon exec` are non-interactive systemd entry points; `--verbose` emits redacted JSONL diagnostics. `maintenance enter` is an idempotent domain transition with a caller idempotency key and explicit dry-run. The review should accept this canon-conformant naming as a correction to ADR 0003's provisional `check-config` and `admin readiness` spellings.

### Foundation green gate — all commands PROPOSED

```sh
go version
go fmt ./...
go vet ./...
go test -race ./...
CGO_ENABLED=0 go build -trimpath ./cmd/native-agent-host
node --version
npm --version
npm ci --prefix web
npm run format:check --prefix web        # Biome
npm run lint --prefix web                # Biome Hooks + JSX a11y
npm run typecheck --prefix web           # tsc --noEmit
npm run test:unit --prefix web
npm run test:component --prefix web
npm run test:e2e --prefix web
npm run test:a11y --prefix web
npm run build --prefix web
npm run build-storybook --prefix web
go generate ./internal/contracts
./scripts/check-generated.sh
python3 issues/define-host-contracts/validate_contracts.py
./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/
./scripts/verify-release.sh --archive dist/native-agent-host-0.0.0-test-linux-amd64.tar.gz --json
./scripts/ci-local.sh --clean --json
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
```

Biome 2.5.14 is the formatter/linter; `tsc --noEmit` remains the type checker. The lint config makes recommended accessibility plus `noNoninteractiveElementInteractions`, `useKeyWithClickEvents`, `useHookAtTopLevel` and `useExhaustiveDependencies` errors. A missing required rule blocks unless one focused TS7-compatible lint tool is supported by primary evidence. Never retry or force the rejected `typescript-eslint` 8.70.1 graph, whose peer range excludes TS7.

`ci-local.sh` is the bare-CI approximation: disposable HOME, Go/npm/browser caches, no repository-external credentials, `CI=1`, locked/offline-after-fetch dependencies, generated-type drift, Go/frontend/contract checks, package reproducibility and clean-tree assertion. CI invokes the same script after explicit dependency/browser provisioning. A failed, skipped or unavailable command is not green.

## Contract corrections accepted as plan recommendations

`build-app-foundation` must apply these additive v1 corrections and CT fixtures **before** product slices consume generated types. Review accepts their observable policy; the foundation makes schemas/examples/tests executable.

1. **Operation retention/query (CG-01).** Add `GET /api/v1/operations/<operation-id>`. Snapshot carries non-terminal operations. Terminal operations are retained in a bounded in-memory daemon-epoch store with the same proposed bound as command outcomes: newest 10,000 or 24 hours, whichever expires first. Response includes `ledger_epoch` and `expires_at`. Missing/evicted/previous-epoch returns `404 operation_outcome_unknown`; absence never means success. Add CT-030 for reload/deep-link/query/eviction/restart.
2. **Queue-clear removed values (CG-02).** A successful `agent.queue.clear` result carries `removed_queue: {steering:[{text,original_index}], follow_up:[{text,original_index}]}` in exact Pi source order, plus the post-clear queue revision. Only these returned texts may be restored to the editor, steering first then follow-up; a stale/failed/uncertain result carries no removed values. Add CT-031 including a race where a delivered item is not returned.
3. **GitHub-create confirmation (CG-03).** The fresh capability/preflight view supplies `confirmation_challenge:{kind:"exact_repository",expected:"owner/repository"}`. Request supplies `confirmation` byte-for-byte equal to `expected`, without trim/case folding. It is bound to the target observation token; mismatch is `confirmation_mismatch`, stale observation is `stale_precondition`. Foundation changes the existing confirmation constraint to `minLength:3` and a maximum derived from the owner plus slash plus repository bounds. Add CT-032.
4. **Native question cancellation (CG-04).** `response:null` is supported only when the Pi adapter has proved that the specific extension request accepts native cancellation. The capability is per request. Adapter cancellation must yield `question.resolved` with outcome `cancelled`; otherwise the action is `capability_unknown`/`unsupported` and no null is sent. Add CT-033 for supported, unsupported and resolved-elsewhere races.

These corrections do not select Go/React or change native authority. They close design/contract ambiguity before implementation code depends on it.

## Shared fixtures and evidence rules

- **VM identities and executor:** `agent-a` and `agent-b`, distinct synthetic UIDs/homes/sentinels, plus fixed `native-agent-host-gateway`; deterministic fake GitHub numeric IDs plus optional OIDC subjects. `build-app-foundation` owns `scripts/vm-test.sh`, a pinned QEMU cloud-image/checksum recipe, cloud-init fake OIDC fixture and GitHub-hosted Ubuntu CI job. It uses KVM when the runner exposes it and deterministic QEMU TCG otherwise. The guest runs systemd as PID 1, binds no host home, SSH agent or credentials, and reset destroys the VM.
- **Native fixtures:** one non-Git directory, one local Git repo, one linked manual worktree, one Taskfleet-owned disposable worktree, Pi 0.85.1 redacted JSONL plus one disposable live session per identity, long 2,500-entry history, malformed/unknown event, long output, `edit` diff and extension question.
- **Pilot identities:** actual Jari and Kaisa stable GitHub numeric IDs mapped by reviewed Fleetrepo config to Unix users `jari` and `kaisa`. The second account does not yet exist and must be created only by the accepted Fleetrepo change. Pi credentials remain native. One GitHub authorization establishes web identity and forwards its token once to the mapped daemon for supported `gh auth login --with-token --git-protocol https` plus `gh auth setup-git`; the gateway never stores it.
- **Remote GitHub boundary:** deterministic fixtures cover ordinary behavior; one uniquely named private disposable repository with a synthetic marker supplies the feature-acceptance smoke and screenshots. Exact owner/name/visibility and verified cleanup are mandatory. There is no broad per-user permission campaign or valuable/org policy mutation.
- **Evidence:** every `result.md` records input/review SHA, tested product SHA, exact commands/exit codes, CT IDs, browser screenshots or traces where relevant, native-source comparison, known limits and successor handoff. Static design and mocks never count as native/runtime proof.
- **Test tiers:** the credential-free bare gate runs all deterministic tests; native/network/systemd suites are feature-gated out of the bare Cargo invocation and have explicit per-issue commands that must run in the VM or authorized remote fixture. They are not `#[ignore]`d and may not be reported green from a skip.
- **Contract evolution:** any later slice may make an additive v1 schema change only with matching examples, a new CT ID, regenerated types and a `result.md` compatibility note. Removal, rename, nullability/ordering change or weaker security semantics require a correction issue and human review.

## User-visible slice acceptance

User-visible implementation work provides proportionate browser evidence and screenshots in `issues/<slug>/visual-acceptance.md`, identifying the tested revision, environment and relevant outcomes. Record Jari's visual verdict when given and keep unreviewed appearance marked as such. A pending screenshot verdict does not block functional completion or independent downstream work; technical dependencies and file collisions still govern scheduling.

All repeated or interactive behavior is owned by shared production primitives/product components. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. A slice that replaces a canonical/root mock removes that superseded reference after acceptance; originals remain only issue-local historical evidence.

## Downstream briefs

### `build-app-foundation` — foundation and contract gate

- **Inputs/IDs:** frozen inputs; CG-01–CG-04; CT-001–CT-034; Proposed ADR 0002/0003 only after review acceptance.
- **Visible output:** authenticated shell route skeleton, Finnish loading/auth/daemon error boundaries, token-loaded empty app and explicit test-fixture mode; no claimed real journey.
- **Non-goals:** no live OIDC provider, native workspace/history, Pi control, production deploy or accepted design-system completion.
- **Ownership:** root Go manifests, `cmd/`, `internal/`, `web/` scaffolding, `scripts/`, `.github/workflows/`, `systemd/`, generated type families, root and local `AGENTS.md`; may update `contracts/v1/` for CG-01–04. It also owns the QEMU systemd-VM harness, pinned image recipe/checksum, fake provider and CI executor.
- **Tests:** deterministic contract generation/negative validation; Go CLI/error/config/version units; gateway/daemon smoke over disposable sockets; QEMU boot/systemd/two-UID/fake-GitHub-OAuth harness self-test; frontend route/error/component harness; package contents/checksum/reproducibility; clean-environment CI script.
- **Commands/green gate:** implement and pass every command in “Foundation green gate”; zero drift, zero skipped required checks, committed lockfiles, package verified.
- **Evidence/rollback:** `result.md`, CI URL/artifacts, generated-type clean diff and test package manifest. Roll back by reverting scaffold commit; no machine state exists. Unblocks `build-design-system`.

### `build-design-system` — production component implementation

- **Inputs/IDs:** production design/catalog revision `62c0…`; ADR 0002 wrappers; CG-01–04 view states.
- **Visible output:** both themes and the catalog's exact primitives/product components imported from `web/src/components` by both app and Storybook.
- **Non-goals:** no HTTP/SSE ownership, domain reconciliation, mock capability promotion or complete journeys.
- **Ownership:** `web/src/components/**`, stories, component CSS/tests, design-system integration docs; no host crates.
- **Tests:** catalog matrix, keyboard/dialog return focus, 200% zoom, reduced motion, non-color status, hostile/long Finnish content, axe and visual snapshots in light/dark.
- **PROPOSED commands:** foundation gate plus `npm run storybook:test --prefix web` and `npm run test:visual --prefix web`.
- **Green/evidence/rollback:** all required stories and accessibility assertions pass; published local static Storybook artifact references the same modules. Revert component commit without schema/data migration. Unblocks `build-workspace-slice`.

### `build-workspace-slice` — authenticated two-user walking slice

- **Inputs/IDs:** Y1 and Y2 discovery/gate-blocked prerequisite; ADR 0003 identity/socket rules. The CT ownership table below is authoritative.
- **Visible output:** explicit provider selection → primary GitHub OAuth or optional Google identity → fixed identity → correct daemon → real immediate `~/src` directories, including non-Git/no metadata, with loading/empty/missing/error/stale views. The one GitHub authorization also configures native `gh` HTTPS through the one-time UDS token handoff.
- **Non-goals:** opening Git repo past integration gate, history/control, host lifecycle writes or Alder deployment.
- **Ownership:** gateway OAuth/OIDC/session/CSRF/mapping modules, daemon UDS/auth/workspace-read/native-credential setup modules, app login/rail routes and integration tests. No shared component redesign.
- **Tests:** two synthetic identities/UIDs, stable GitHub numeric-ID mapping, state and PKCE S256, optional Google no-request-before-selection, unknown/duplicate mapping, wrong peer UID/socket/mode, forged headers, origin/CSRF/session expiry/web logout, transient token one-time forwarding, `gh` stdin login/setup-git, protected-storage/fallback modes, partial login, explicit disconnect, source path escape/symlink, gateway home denial and token/credential/log scans.
- **PROPOSED commands:** foundation gate; `go test ./internal/gateway -run OAuthSession`; `go test ./internal/daemon -run SystemdTwoUser`; `npm run test:e2e --prefix web -- --grep @workspace-slice`; `./scripts/vm-test.sh two-user-routing --json`.
- **Green/evidence/rollback:** real UDS routes under distinct UIDs, zero cross-user sentinel reads, Y1 and discovery portion of Y2 recorded. Destroy VM to roll back. Unblocks `build-history-view`.

### `build-history-view` — native Pi history

- **Inputs/IDs:** Y3 and the CT ownership table below; Pi probe `4187…`.
- **Visible output:** selected `pi:<sessionId>` opens native messages/code/generic tools safely, with read-only/process/control distinctions and paging/continuation.
- **Non-goals:** start/resume/send, rich final tool grouping/diff polish or title model call.
- **Ownership:** Pi history adapter/read endpoints, history/content generated types, timeline baseline and history browser tests.
- **Tests:** redacted fixture and disposable native Pi history; missing/corrupt/moved-cwd/unknown event; 200-entry pages, 65,536-byte UTF-8 chunks, 1,000-event live-tail rejection; reopen gives same native keys and no copied DB.
- **PROPOSED commands:** foundation gate; `go test ./internal/daemon -run PiHistory`; `node issues/probe-pi-control/probe.mjs --verify --output issues/probe-pi-control/events.redacted.jsonl`; `npm run test:e2e --prefix web -- --grep @native-history`.
- **Green/evidence/rollback:** HTTP output matches source JSONL keys/content, no write/resume on open. Revert adapter/UI; native fixture is disposable. Unblocks `build-agent-control`.

### `build-agent-control` — complete walking core

- **Inputs/IDs:** Y4–Y5, the CT ownership table below and A14 proof.
- **Visible output:** start a browser conversation, continue an ended browser conversation with its native history, acknowledged send, live response/tool events over SSE, best-effort interruption and browser reconnect.
- **Non-goals:** terminal takeover, simultaneous independent writers, Pi-specific question dialogs, complete M1 presentation, queue clear until CG-02 passes, host lifecycle features or daemon-crash survival.
- **Ownership:** mapped-UID Pi RPC controller, HTTP commands, SSE updates and the core browser journey. Pi retains tool execution, configuration and history.
- **Tests:** browser disconnect leaves Pi running; SSE reconnect and slow-reader recovery; accepted/rejected/uncertain send without automatic resend; ended browser conversation continuation; honest interruption and daemon-restart status; session/UID authorization. Terminal histories stay read-only. No cross-process writer takeover or per-controller cgroup proof is required.
- **Checks:** the clean local gate plus focused browser, native Pi and UID-isolation evidence for the current implementation. Earlier numeric retention limits and command names are proposals, not extra acceptance conditions; the current scope is in [the issue](../build-agent-control/item.md).
- **Green/evidence/rollback:** Y1–Y5 one real disposable session lifecycle plus two-user routing, no duplicate writer/message. Kill fixture processes and destroy VM; never delete native user histories. Unblocks `complete-conversation-ui`.

### `complete-conversation-ui` — accepted M1 experience

- **Inputs/IDs:** M1, CG-01/02/04 and the CT ownership table below; production catalog.
- **Visible output:** sanitized Markdown, code, Pi edit diff, grouped tools, long content, unknown fallback, questions, interrupt, steer/follow-up and safe whole-queue clear; durable draft/focus/route/reading/attention behavior.
- **Non-goals:** process center, mobile, OS notifications, synthetic bash diffs, arbitrary queue reorder/cancel or host operations.
- **Ownership:** conversation components/view models, Shiki worker, Markdown/diff policy, virtualization/paged mode, catalog stories/browser/a11y tests.
- **Tests:** malformed Markdown/URLs/diff/CSP; replacement vs append tool output; real queue order and clear race; variable-height anchor, focused row retention, copy/selection, screen-reader cadence, keyboard/IME, dark/light/zoom/reduced motion; title input is the source-ordered unique union of at most first four and last four user messages; title-adjacent manual regeneration covers capability, pending concurrency exclusion, success and nonblocking failure.
- **PROPOSED commands:** foundation gate; `npm run test:e2e --prefix web -- --grep @conversation`; `npm run test:a11y --prefix web -- --grep @conversation`; `npm run test:performance --prefix web -- --scenario long-history`.
- **Green/evidence/rollback:** M1 and budget report pass on pilot desktop; no unbounded initial/lazy chunk regression. UI rollback is release rollback; no native data migration. Unblocks `manage-workspace-lifecycle`.

### `manage-workspace-lifecycle` — M2/M3 local lifecycle

- **Inputs/IDs:** M2–M3 and the CT ownership table below; workspace probe `c1e0…`.
- **Visible output:** create directory/local Git, display-name setting, hide/show, blocking Git integration and staged safe deletion.
- **Non-goals:** GitHub remote operations, manual worktree management, hidden rollback claim or registry.
- **Ownership:** descriptor-relative filesystem/Git adapter, workspace settings/XDG annotation writes, create/settings/integration/delete UI and tests.
- **Tests:** duplicate/permission/race/symlink/rename/owner-mode/mount/unreadable entries; process cwd/open file/PID reuse; external/manual linked worktree; Taskfleet-owned teardown delegation; kill at every stage and atomic annotation recovery; fresh absence required.
- **PROPOSED commands:** foundation gate; `go test ./internal/daemon -run WorkspaceLifecycle`; `npm run test:e2e --prefix web -- --grep @workspace-lifecycle`; `./scripts/vm-test.sh path-races --json`.
- **Green/evidence/rollback:** M2/M3 compare every stage to filesystem/Git/Taskfleet facts; no outside sentinel changed. Recovery uses fresh observation and native owners, never blind reverse actions. Unblocks `connect-github-workspaces`.

### `connect-github-workspaces` — M4

- **Inputs/IDs:** M4; CG-03; CT-018/032; A6; the accepted focused private-repository smoke.
- **Visible output:** blocking integration facts and exact create/clone flows; create, origin, transport and push remain separate stages.
- **Non-goals:** gateway credential broker, browser secret upload, valuable/org repo mutation or inferred permission.
- **Ownership:** same-user `gh`/Git argv adapter, GitHub dialogs/operations and deterministic fixtures plus one remote smoke.
- **Tests:** deterministic fixtures cover identity/path/stage failures, denied owner, collision, network loss after create, push denial, target collision, confirmation mismatch/stale token and cross-user routing. One mapped identity creates one unique private marked repo, verifies API/HTTPS helper/ordinary Git push, clone/pull and object IDs, and performs exact separately confirmed delete plus 404. The acceptance report includes essential screenshots. No second broad user/repository campaign is required.
- **PROPOSED commands:** foundation gate; `go test -tags=nativefixtures ./internal/daemon -run GitHub`; `npm run test:e2e --prefix web -- --grep @github`; `./scripts/vm-test.sh github-private-smoke --json`.
- **Green/evidence/rollback:** cross-user fixture tests pass and one private remote smoke passes from the mapped daemon service environment, no credential reaches gateway/browser/log; reset verifies exact synthetic marker and remote absence while retaining local fixture until confirmed. Unblocks `manage-agent-worktrees`.

### `manage-agent-worktrees` — M5

- **Inputs/IDs:** M5; CT-019; actual Taskfleet 0.11 create/show/merge/cancel surfaces.
- **Visible output:** Git-main-workspace dialog starts a Taskfleet-owned run with source branch/title/task, then navigates to the observed agent; manual worktrees remain read-only impacts.
- **Non-goals:** generic Taskfleet protocol, guessed final branch/path, raw `git worktree` creation or teardown.
- **Ownership:** Taskfleet adapter/ownership join, worktree dialog/navigation and disposable repo tests.
- **Tests:** non-Git disabled; duplicate branch/path, dirty source policy, create interruption before/after publication, partial teardown, missing owner join, disconnect; compare full run/node identity with Git porcelain and Pi cwd.
- **PROPOSED commands:** foundation gate; `go test ./internal/daemon -run Taskfleet`; `npm run test:e2e --prefix web -- --grep @taskfleet`; `./scripts/vm-test.sh taskfleet-partial --json`.
- **Green/evidence/rollback:** M5 passes with Taskfleet as sole mutator and complete cleanup through its lifecycle. Unblocks `archive-agent-conversations`.

### `archive-agent-conversations` — M6

- **Inputs/IDs:** M6; CT-021; annotation and Pi resume contracts.
- **Visible output:** separate managed stop, archive annotation, archive list, unarchive and same-ID resume; read-only histories remain honest.
- **Non-goals:** copied transcript/archive DB, combined hidden stop+archive, deleting history or signalling observed PID.
- **Ownership:** sparse XDG conversation annotation, archive commands/read models/dialog and native resume tests.
- **Tests:** active writer conflict, stop failure, annotation corruption/power loss, missing history, unarchive without focus, resume failure, disconnect/stale command and same `pi:<id>` after continue.
- **PROPOSED commands:** foundation gate; `go test ./internal/daemon -run Archive`; `npm run test:e2e --prefix web -- --grep @archive`.
- **Green/evidence/rollback:** M6 with no second history and presentation-only annotation loss semantics. Rollback leaves Pi JSONL untouched; restore only atomic annotation backup if proven. Unblocks `prepare-mvp-operations`.

### `prepare-mvp-operations` — release and Fleetrepo handoff

- **Inputs/IDs:** M7 packaging half; accepted ADR 0003, Fleetrepo policy, all prior result SHAs. Native Agent Host owns generic self-hosting docs; Fleetrepo receives only a coordinated Alder-specific declaration.
- **Visible output:** verified release archive and `docs/operations.md`; disposable install/update/failed-update/rollback/reset evidence. Alder deployment is permitted after gates, but not before the separate Fleetrepo change lands.
- **Non-goals:** editing Fleetrepo from this repo worker, source-installing, ad-hoc root changes, final pilot acceptance or deleting user-native state.
- **Ownership:** this repo owns archive/manifest/checksum, release CI, service templates/defaults and generic install/configure/test-host/update/rollback/live-version/operator docs usable to build any Alder-like host. `/home/maintainer/Sources/fleetrepo` owns only Alder account/gateway user/groups, packages/releases, sysusers/tmpfiles, systemd units/sockets, identity mappings, encrypted provider input, Tailscale route, release pin/check and convergence. At 0.1 release readiness, the conductor files a new repo issue—not before—to remove Alder-specific references from Git HEAD while preserving generic docs and issue-local history.
- **Coordination and completion gate:** the conductor files and runs a separate Fleetrepo issue/worktree from the Fleetrepo checkout with this release/version/SHA and accepted unit/config bytes; review/commit/push there, then use Fleetrepo's documented Alder root-hook plus unprivileged fleet check workflow. This issue remains open until the Fleetrepo issue/commit SHA and converged check are recorded in its `result.md`, so the existing DAG edge to `verify-v1-resilience` cannot release early. Never make Fleetrepo mutation an undocumented side effect here. Jari's implementation-plan acceptance authorizes this reviewed change and apply without another human ack; material deviation returns to review.
- **PROPOSED package commands:** foundation package/verify commands, `CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" ./cmd/native-agent-host`, and `./scripts/vm-test.sh release-lifecycle --json`.
- **Green/evidence/rollback:** immutable release N installs, second apply is no-op, N+1 update and intentionally failed activation preserve N, rollback selects N and repeats smoke; `docs/operations.md` matches executable commands. Unblocks `verify-v1-resilience`.

### `verify-v1-resilience` — full M7 and pilot verifier

- **Inputs/IDs:** Y1–Y5, M1–M7; CT-001–033; every implementation result and operations runbook.
- **Visible output:** pilot report and authenticated demonstration for Jari; no automatic `review-mvp` acceptance.
- **Non-goals:** new features, cache/supervisor addition without measurements, changing accepted design or post-MVP work.
- **Ownership:** issue-local pilot scripts/results/traces and durable status/operations corrections; Fleetrepo worker remains owner of persistent target declarations.
- **Tests:** both actual web identities and Unix routes; wrong numeric identity/socket/header/peer/path; all accepted journeys; two concurrent agents plus Taskfleet worktree; terminal read-only transfer; long history/output/diff/question/unknown event; browser/SSE/gateway/daemon crash/restart, update, rollback; SSH/tmux/native Pi continuity; zero cross-user leak/data loss/silent duplicate. Jari and Kaisa each complete one normal provider login before automation; scripts consume a mode-0600 exported session artifact, destroy it at teardown and fail if any admin/test session-mint endpoint exists.
- **PROPOSED commands:** foundation gate plus the exact Alder sequence below and `./scripts/pilot-smoke.sh --origin "$ORIGIN" --identity <id> --json`, `./scripts/pilot-negative-cross-user.sh --json`, `./scripts/pilot-resilience.sh --json`, `./scripts/pilot-reset.sh --manifest <run.json> --json`.
- **Green/evidence/rollback:** all mapped Y/M criteria pass; zero-tolerance observations are zero; defects are linked before Jari review. Pilot reset removes only manifest-owned workspaces/remotes/processes; Fleetrepo rollback restores prior release/declaration, never histories/credentials.

## Proposed Fleetrepo/Alder command shapes

These are **PROPOSED, not executable now**. `prepare-mvp-operations` must replace placeholders, make product scripts real, and coordinate the separate reviewed Fleetrepo issue. Authorization for Alder and the privileged route is already granted after review and all gates. The primary forms below assume the conductor is already on the tw server Alder; from another seat, the documented fallback is the authorized `ssh rowan ssh alder[-root]` route.

```sh
# Read-only preflight. Capture the complete warning set as a baseline: green
# means no new warnings and every native-agent-host component is clean.
cd "$HOME/Sources/fleetrepo"
fleetrepo fleet component list --json
fleetrepo fleet status --json
fleetrepo fleet doctor --json

# Fleetrepo's reviewed hook owns the transaction. On first install there is no
# current binary. On update it uses the known-good current release to enter
# maintenance, proves zero active daemon-owned Pi writers, quiesces sockets,
# switches/checks, and always leaves maintenance on success or recovery.
ssh alder-root /bin/bash -s <<'ALDER_ROOT'
set -euo pipefail
cd /home/maintainer/Sources/fleetrepo
DOTFILES_HOSTNAME=alder dotfiles/setup.d/alder-native-agent-host.sh
ALDER_ROOT

# Declared-state, live-version and aggregate health as jari.
cd "$HOME/Sources/fleetrepo"
DOTFILES_HOSTNAME=alder dotfiles/setup.d/alder-native-agent-host.sh --check
fleetrepo fleet doctor --json
/opt/native-agent-host/current/native-agent-host version --json
systemctl is-active native-agent-host-gateway.service \
  native-agent-host-daemon@jari.socket \
  native-agent-host-daemon@kaisa.socket
curl --fail --silent --show-error "$ORIGIN/healthz"
curl --fail --silent --show-error "$ORIGIN/readyz"

# Detailed service-context readiness.
ssh alder-root /bin/bash -s <<'ALDER_ROOT'
set -euo pipefail
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host doctor --component gateway --json
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host admin readiness show --json
ALDER_ROOT

# Authenticated product-owned smoke/negative/update checks (implemented later).
./scripts/pilot-smoke.sh --origin "$ORIGIN" --session-file <mode-0600-jari-session> --json
./scripts/pilot-smoke.sh --origin "$ORIGIN" --session-file <mode-0600-kaisa-session> --json
./scripts/pilot-negative-cross-user.sh --origin "$ORIGIN" --json

# Rollback: revert the reviewed Fleetrepo release declaration, review/commit/push,
# then let the hook use an explicitly selected last-known-good release binary
# (never a broken current binary) to quiesce/switch/check/leave maintenance.
git -C "$HOME/Sources/fleetrepo" revert <native-agent-host-release-commit>
```

Fleetrepo hook activation handles first install separately from update; on update it stops both socket units before services, proves they cannot reactivate old daemons, refuses active writers, runs config checks, atomically selects an immutable checksum-verified release, starts sockets only after checks and exits maintenance. Rollback selects a verified release path rather than trusting a broken `current`. A second apply is a no-op. Reset and rollback are manifest-driven and preserve Pi histories, Git state, workspace settings, annotations and credentials. The Fleetrepo issue also updates `dotfiles/docs/ALDER_AGENT_HOST.md` and either resolves its pre-existing `tailscale-update-policy.sh` inventory warning or records it as an unchanged baseline; native-agent-host may add no warning.

## Contract-scenario implementation ownership

Each contract scenario has exactly one implementation-test owner before the final verifier reruns all of them.

| Scenario | Implementation-test owner |
|---|---|
| CT-001, CT-002, CT-023, CT-026 | `build-workspace-slice` |
| CT-027 | `build-app-foundation` |
| CT-013 | `build-history-view` |
| CT-003, CT-004, CT-005, CT-006, CT-007, CT-008, CT-009, CT-010, CT-011, CT-012, CT-014, CT-015, CT-022, CT-028, CT-030 | `build-agent-control` |
| CT-025, CT-031, CT-033 | `complete-conversation-ui` |
| CT-016, CT-017, CT-020, CT-024, CT-029 | `manage-workspace-lifecycle` |
| CT-018, CT-032, CT-034 | `connect-github-workspaces` |
| CT-019 | `manage-agent-worktrees` |
| CT-021 | `archive-agent-conversations` |

## Success-criterion ownership map

Exactly one implementation owner and one end-to-end/pilot verifier owns each criterion.

| Criterion | Implementation owner | End-to-end/pilot verification owner |
|---|---|---|
| Y1 authentication/routing | `build-workspace-slice` | `verify-v1-resilience` |
| Y2 discovery/Git gate | `connect-github-workspaces` (the earlier workspace slice supplies discovery and the blocked gate shell) | `verify-v1-resilience` |
| Y3 native history/read-only truth | `build-history-view` | `verify-v1-resilience` |
| Y4 start/resume/send/live result | `build-agent-control` | `verify-v1-resilience` |
| Y5 disconnect/reconcile | `build-agent-control` | `verify-v1-resilience` |
| M1 conversation UX | `complete-conversation-ui` | `verify-v1-resilience` |
| M2 create/settings | `manage-workspace-lifecycle` | `verify-v1-resilience` |
| M3 visibility/delete | `manage-workspace-lifecycle` | `verify-v1-resilience` |
| M4 GitHub | `connect-github-workspaces` | `verify-v1-resilience` |
| M5 Taskfleet worktree | `manage-agent-worktrees` | `verify-v1-resilience` |
| M6 archive/continue | `archive-agent-conversations` | `verify-v1-resilience` |
| M7 operations/isolation | `prepare-mvp-operations` | `verify-v1-resilience` |

The demonstrable walking core remains: foundation → design system → authenticated two-user workspace → native history → Pi control. Full conversation and host lifecycle follow; no accepted M1–M7 feature is deferred.
