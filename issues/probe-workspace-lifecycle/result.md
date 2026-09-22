# Native workspace lifecycle probe

## Outcome

The accepted lifecycle can be built without a workspace registry, copied Git
state, credential broker, or second conversation history. Immediate directories
under `~/src` are the native workspace inventory. For destructive operations,
only revalidated non-symlink directories are supported; a symlinked entry must
remain visible as an observed, unsupported entry with mutations disabled until
product review decides otherwise. Git remains the source for repository and
worktree identity, Taskfleet remains the only supported creator/manager of agent
worktrees, and Pi's resume ID remains conversation identity.

Two small annotation boundaries are justified by behavior that native sources do
not carry:

1. workspace settings already accepted in `.agent-host/workspace.json`; and
2. a sparse per-Unix-user conversation-annotation file under the user's XDG state
   directory, keyed by the native identity such as `pi:<session-id>`.

The latter is not a history or agent registry: absent keys mean no annotation,
and deleting it loses presentation choices only, never native history. Exact
schema and atomic-write semantics belong to `define-host-contracts`.

Deletion must be a checked, staged operation, not a recursive-path convenience.
Linux allowed a fixture directory to be removed while a process still had it as
its current directory. Raw removal of a linked Git worktree left native stale
worktree metadata. A lexical child symlink resolved outside its source root.
These observed outcomes require preflight, process ownership checks, native
Taskfleet/Git handling, no-follow path resolution, and explicit partial results.

## Inputs, revisions, and inspected software

Probe date: 2026-09-22. The source branch revision when Taskfleet created this
worker was `a41065f5984621e4c7c76050960b4e1ed3841086`. The required in-progress
metadata was committed separately as
`c022552620adc19cc44cc4694710c56425188b92` before the substantive probe.

| Input | inspected revision |
|---|---|
| `issues/plan-v1-implementation/plan.md`, root `AGENTS.md`, `AGENTS-WORKFLOW.md` | `a41065f5984621e4c7c76050960b4e1ed3841086` |
| `docs/product.md`, `docs/architecture.md` | `3d160ddd9e7b2b94468fa9d4112e544b7fc12fbf` |
| `docs/adr-0001-unix-native-agent-host.md` | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| `docs/AGENTS.md` | `0b0a16419e280aff57f08ce6a747fcb03584488c` |
| `issues/probe-workspace-lifecycle/item.md` | `c022552620adc19cc44cc4694710c56425188b92` |
| Pi control evidence used for native conversation facts | `issues/probe-pi-control/result.md` at worker starting revision |

Inspected runtime versions were Linux `7.0.0-31-generic` x86-64, Python
`3.14.4`, Git `2.53.0`, GitHub CLI `2.46.0`, issuectl `0.18.4`, and Taskfleet
`0.11.0` at commit `fc99e51f44d3e08e03ab80a29318376dcbd7e23d`
(state schema 1). Primary local interfaces were `git worktree --help`,
`gh auth status --help`, `gh repo create --help`, `gh repo clone --help`,
`taskfleet run create --help`, `taskfleet run show --current --output json`, and
Taskfleet's version envelope.

## Reproducible disposable probe

`probe.py` creates all fixtures beneath this issue directory, records only
redacted evidence, and removes the fixture in `finally`. It uses a synthetic
local Git identity. It does not read user credentials, contact GitHub, inspect
Pi history, create another Taskfleet run, or touch a real workspace.

Run from any checkout's repository root:

```sh
python3 issues/probe-workspace-lifecycle/probe.py \
  --output issues/probe-workspace-lifecycle/evidence.json
find issues/probe-workspace-lifecycle -maxdepth 1 -name '.probe-tmp-*' -print
```

Outside a Taskfleet-owned worktree, the local fixture still succeeds and records
`taskfleet_native_association.status: not_in_taskfleet_worktree`; the preserved
association below is specific to this worker. The second command produced no
paths. `evidence.json` has `all_assertions_passed: true`. Important observed facts:

- Listing immediate entries with `is_dir(follow_symlinks=False)` found the plain
  and Git directories and rejected the directory symlink.
- `git init --initial-branch=main`, a synthetic commit, and
  `git worktree add --detach` succeeded. Both worktrees resolved to the same
  native common Git directory while the linked worktree had its own Git
  administrative directory.
- The linked worktree was deliberately outside the synthetic `src`. Raw removal
  left it in `git worktree list --porcelain` as prunable;
  `git worktree prune --dry-run --verbose --expire=now` identified the stale
  native metadata. In the inverse case, raw removal of the main worktree left
  the outside linked directory present but `git status` failed with exit 128
  because its common Git directory was gone. The supported operation must
  therefore use Taskfleet and Git, not delete either directory behind them.
- A path lexically below synthetic `src` resolved through a symlink to
  `<FIXTURE>/outside`. Python's fd-safe `shutil.rmtree` removed a workspace
  containing a descendant link while preserving the synthetic outside
  sentinel. A deliberately vulnerable resolve-then-delete sequence destroyed a
  second synthetic outside target and left the workspace symlink behind. These
  are primitive-specific observations: discovery and destructive path
  resolution must not follow either workspace or descendant symlinks.
- A `sleep` process retained `<FIXTURE>/src/busy (deleted)` as its current
  directory after that directory was removed. Filesystem success is not proof
  that affected processes stopped.

### Taskfleet-managed worktree and native identity

This worker itself is the non-disposable extra Taskfleet fixture already created
for the issue, so no second run was spawned. Read-only correlation showed:

- exact Taskfleet run `01m34qmt6ya60611rtj6y244dd`, kind `spinoff`, source branch
  `main`, harness `pi`;
- worktree path
  `<HOME>/Sources/native-agent-host__worktrees/wt-rtj6y244dd-probe-workspace-lifecycle`;
- Git branch `wt/rtj6y244dd-probe-workspace-lifecycle`;
- per-worktree Git directory below
  `<HOME>/Sources/native-agent-host/.git/worktrees/…`; and
- common Git directory `<HOME>/Sources/native-agent-host/.git`.

Taskfleet's run record supplies ownership/lifecycle facts; Git supplies the
branch, HEAD, common-repository identity, and complete worktree list. Neither is
a substitute for Pi's native `pi:<session-id>` identity. A UI association should
join these observed facts and retain “unknown” when a join cannot be established.
It must not derive ownership from a branch display fragment.

## GitHub authorization boundary

Only read-only/authentication operations were performed on host `alder` as Unix
user `jari`. No repository was created, deleted, pushed, renamed, or
reconfigured, and no token value was printed or saved. The secret-free output is
preserved in `github-evidence.json`; reproduce it with:

```sh
python3 issues/probe-workspace-lifecycle/probe_github.py \
  --repository maintainer/native-agent-host --remote origin \
  --output issues/probe-workspace-lifecycle/github-evidence.json
```

Its underlying commands and outcomes were:

```sh
gh auth status                         # success; active github.com account, SSH Git protocol
gh api user --jq '{login:.login,id:.id}'
                                       # success; maintainer, id 1272053
gh repo view maintainer/native-agent-host \
  --json nameWithOwner,viewerPermission,isPrivate
                                       # success; private, viewerPermission ADMIN
ssh -o BatchMode=yes -o ConnectTimeout=10 -T git@github.com
                                       # authenticated as maintainer; exit 1 is GitHub's
                                       # documented/no-shell handshake result
git remote get-url origin             # parsed and stored only as sanitized host/protocol/owner/repo
git ls-remote --exit-code origin HEAD  # success; exact observed HEAD is in github-evidence.json
```

`gh auth status` was invoked separately without `--show-token`; its normal output
was not persisted because it includes credential metadata. The evidence script
requests only selected API fields and records no SSH configuration or token
material. The current repository's remote is SSH. Global/local Git inspection
found no configured
`credential.helper`; that is expected for this SSH remote and is not evidence
that every repository transport works.

The evidence generator requires the sanitized `origin` identity to equal the
API-selected `OWNER/REPO`; an unrelated remote cannot make the aggregate check
pass. These facts establish three separate boundaries for this user and this
host: GitHub API authentication works, SSH authentication works, and read
transport to this existing private repository works. They do **not** prove permission to
create in every owner/organization, push to an arbitrary repository, satisfy
SSO, select a team, or delete a repository. `gh` login alone is not the product's
Git integration gate. The gate must inspect the chosen owner/repository and the
actual final remote transport from the same daemon environment in which agents
will run ordinary Git commands.

### Proposed create flow

1. Resolve the authenticated account with the GitHub API and list only owners in
   which creation is allowed. Ask for owner, unique repository name, visibility,
   and exact confirmation. Never infer an organization or visibility.
2. Revalidate the local directory by descriptor: direct workspace, Git repo,
   expected HEAD, no unexpected `origin`, and no unresolved integration error.
3. Call non-interactive `gh repo create OWNER/NAME --private|--public|--internal
   --source=<workspace> --remote=origin` as the mapped Unix user. Do not use
   `--push` in the same call: remote creation and initial push need separately
   reportable outcomes.
4. Read the resulting `origin` from Git, verify repository identity and current
   permission through `gh repo view`, verify read transport, then perform an
   ordinary `git push -u origin <branch>` from the same environment an agent
   receives.
5. Report each stage independently. If creation succeeds and remote setup or
   push fails, keep and show the real remote repository and local Git state;
   never claim rollback. Retry only the failed stage after a fresh observation.

### Proposed clone flow

1. Use the authenticated GitHub API to search/select an exact repository and show
   owner, visibility, permission, default branch, and intended SSH/HTTPS remote.
2. Validate and exclusively reserve a new direct child name under `~/src` with
   descriptor-relative, no-follow creation; reject existing paths, symlinks,
   separators, `.`/`..`, canonical escapes, and replacement races.
3. Clone directly into that reserved final directory using `gh repo clone
   OWNER/REPO <target>` (or explicit `git clone` once transport is selected).
   While the operation runs, show the directory as creating and block opening.
   Validate Git's reported remote, common directory, checked-out branch, and
   ordinary fetch transport.
4. Create workspace annotations only if a setting is needed, then run the same
   blocking Git integration gate. On failure, native discovery will still see
   the partial target; show it honestly as a failed/incomplete workspace with
   explicit retry or deletion rather than hiding it or claiming rollback.

### Safe later GitHub write test

In an explicitly authorized disposable owner, create one uniquely named private
repository with no valuable data. Record expected owner/name/visibility first.
From a fresh disposable local repo under the test user's `~/src`, execute create
without push, verify API identity and SSH remote, push one synthetic commit with
plain `git`, clone to a second disposable directory, make/push/pull a second
synthetic commit, and verify both object IDs. Run the whole test separately as
each pilot Unix user from that user's daemon environment. Exercise denied owner,
name collision, network loss after remote creation, push denial, and clone target
collision. Cleanup is a separate, explicitly confirmed final step: verify the
exact repository identity and synthetic marker before `gh repo delete`, verify
404 afterward, and retain the local fixture until remote deletion is confirmed.
This later test needs explicit remote-creation/deletion authorization; this probe
did not have or assume it.

## Minimal annotations

| UI fact | Native source first | Smallest justified annotation | Status |
|---|---|---|---|
| workspace stable ID and display name | directory path/name | optional fields in `.agent-host/workspace.json`, already accepted by product/ADR | proposed shape; location accepted |
| hidden workspace | no native component expresses a user's list choice | sparse per-user XDG entry keyed by stable workspace ID, or canonical path until an ID exists | proposal for contract review; avoids dirtying/read-only workspaces |
| archived conversation | Pi history says the conversation exists, not whether this UI archived it | sparse per-user XDG state entry keyed by `pi:<session-id>`, containing only archive state/time | proposal; necessary for M6 |
| synopsis | derive from native history when a bounded, reliable rule is accepted | store nothing initially; only a user-authored synopsis would justify an optional annotation in the same sparse entry | unknown UI behavior; do not invent model summaries |
| parent context | Taskfleet's `parent_run_id`/`parent_node_id`, extension facts, or another native harness relation | store nothing when native evidence exists; only an explicitly captured otherwise-unrecoverable parent link may be annotated, with source/provenance | proposal; do not infer parentage from branch or conversation branch |

The per-user annotation location should follow
`${XDG_STATE_HOME:-~/.local/state}/native-agent-host/` and be written atomically
with user-only permissions. Its entries should contain the native key and only
the selected presentation fields; no transcript, Git fact, PID, process output,
or copied Taskfleet status. A missing/corrupt annotation source must be reported
as partial metadata while native histories remain readable. Path-keyed hidden
state needs explicit rename behavior until the workspace has a stable ID. Stable
ID/display-name settings in `.agent-host/workspace.json` must honor the existing
user choice about versioning that file versus local `.git/info/exclude`.

## Deletion and path contract

### Required preflight

1. Start from a directory entry discovered directly below an opened `~/src`
   directory descriptor. Preserve symlink entries as visible unsupported facts,
   but reject them and non-directories as destructive targets. Preserve both
   displayed path and stable filesystem identity for revalidation.
2. Require exact user confirmation naming the workspace and canonical path.
   Re-open without following symlinks immediately before mutation and fail closed
   on replacement, rename, ownership change, root/source-root selection, path
   escape, or a mount boundary the implementation cannot safely handle.
3. Snapshot native effects: `git worktree list --porcelain`, Taskfleet runs and
   ownership, managed Pi runtimes, observed `/proc`/tmux processes, open working
   directories/files where reliably detectable, and nested mount points.
   “Not found” and “not observable” are different states.
4. Block when any merely observed/unowned process may use the tree. For managed
   agents, request stop through their owner, wait for native settled/exit facts,
   and re-snapshot. Browser disconnect must not cancel or falsely complete this
   operation.
5. Show linked worktrees outside the workspace as effects. Taskfleet-created
   worktrees are managed only through Taskfleet. Arbitrary/manual worktrees are
   read-only facts and block automatic cleanup. Deleting a main worktree while
   external linked worktrees depend on its common Git directory must be blocked.
6. Reject or separately govern submodules, nested repositories/worktrees, dirty
   worktrees, nested mounts, unreadable entries, immutable files, and permission
   failures. Never cross filesystems or follow descendant symlinks implicitly.

Canonical-string prefix checks are insufficient: the fixture was lexically below
`src` but resolved outside it, and a path can change between check and use. The
host contract should require descriptor-relative, no-follow operations (for
example Linux `openat2` resolution constraints where selected by the host stack)
and revalidation, not prescribe `rm -rf <user-string>`.

### Ordered outcome and partial-result model

The operation should expose durable stages rather than one Boolean:

1. `validated` — target and confirmation still match;
2. `effects_observed` — processes, Taskfleet runs, Git worktrees, mounts, and
   unknowns listed;
3. `managed_processes_stopped` — each stop/settle outcome recorded;
4. `native_worktrees_removed` — only supported Taskfleet/Git operations attempted;
5. `workspace_removal_attempted` — exact directory mutation begun;
6. `source_reobserved` — directory absent/present/unreadable, residual effects
   and stale native metadata reported.

Failure at a later stage never rewrites an earlier success. Examples: stopped
agents plus failed directory removal; removed directory plus a process whose cwd
is `(deleted)`; missing linked-worktree directory plus prunable Git metadata;
removed main worktree plus a surviving linked directory whose Git common
directory is gone; or remote repository creation plus failed local push. The UI must show exactly what
remains and safe retry actions. It may mark a workspace deleted only after a
fresh source listing proves the direct entry absent, while still presenting any
residual process/worktree cleanup as a partial outcome.

## Unsupported, untested, and exact later verification

| Boundary | Current status | Required later verification |
|---|---|---|
| real GitHub create/push/clone/delete | intentionally untested | run the explicitly authorized two-user disposable-remote sequence above, including partial failures and exact cleanup verification |
| organization policy, SSO, teams, branch protection | unknown | use an authorized disposable organization/repository with representative policy; assert API permission separately from ordinary Git transport |
| browser-driven credential login | unsupported by this evidence | design the gateway/daemon UX, then test the chosen device/browser flow; discovery of `gh` auth must not be represented as browser control |
| arbitrary manual worktree management | deliberately unsupported in v1 | display as native read-only impact and verify that destructive controls remain disabled |
| Taskfleet creation failure/branch conflict/partial teardown | not induced in this live run | in a disposable repo, ask Taskfleet to create a dedicated run, induce branch/path conflict and interrupted teardown, and compare Taskfleet run state with Git porcelain before cleanup |
| process enumeration completeness | unknown | implementation tests with managed Pi, tmux-started Pi, unowned same-UID process, cwd/open-file holders, exited PID, PID reuse, and permission-denied `/proc`; unknown observation must block deletion |
| symlink race and mount traversal | semantic cases verified, races/mounts untested | stack-specific integration tests that swap entries during preflight/mutation and mount a disposable filesystem below the target; assert fail-closed/no outside mutation |
| crash/power loss during annotation write or staged deletion | untested | kill the daemon at every recorded stage; verify atomic annotation recovery, native history/Git integrity, and truthful resnapshot |
| rename/move of a workspace with Pi history cwd | untested here | move a disposable workspace and verify history association behavior against the Pi probe's cwd evidence; retain unknown instead of inventing a registry mapping |
| archive/continue UX, synopsis, parent display | not decided by this probe | UI review must choose semantics; contract tests then prove same native resume ID, no copied history, archive restoration, and provenance-bearing parent links |

Browser control is not inferred from directory, process, GitHub, Pi-history, or
Taskfleet discovery.

## Validation and review

The final pre-closure working tree was based on
`c022552620adc19cc44cc4694710c56425188b92` and contained only the owned probe
files. These commands ran from the repository root on 2026-09-22:

```sh
python3 issues/probe-workspace-lifecycle/probe.py \
  --output issues/probe-workspace-lifecycle/evidence.json
# exit 0; all_assertions_passed=true

python3 issues/probe-workspace-lifecycle/probe_github.py \
  --repository maintainer/native-agent-host --remote origin \
  --output issues/probe-workspace-lifecycle/github-evidence.json
# exit 0; boundary_checks_passed=true; selected repository matched sanitized remote

find issues/probe-workspace-lifecycle -maxdepth 1 -name '.probe-tmp-*' -print
# exit 0; no output

python3 scripts/validate-project-view.py
# exit 0: Project View valid: 12 pages, 12 navigation entries.

issuectl doctor --json
# exit 0; no cycles, missing references/blockers, schema violations, status
# inconsistencies, malformed metadata, or warnings

issuectl dag --json --reservations '[]'
# exit 0; blockers_missing=[] for every item; probes lane head was this in-progress
# task; lane members had executable statuses; review-ui-v1,
# review-implementation-plan, and review-mvp were unlaned human-review gates

git diff --check
# exit 0; no output
```

The DAG showed no missing blockers or cycles, no deferred/untriaged item in a
lane, and no executable lane assigned to a human review. The implementation path
remained blocked by its recorded planning and human-review dependencies.

Review level was **critical evidence-gated review** because authorization,
deletion, path escape, and process/worktree ownership are high-risk boundaries.
`claude-fable-5-1` produced concrete candidates; each was checked locally and
corrected. A fresh `gpt-6-astra` verifier refuted the corrected candidates,
confirmed that final validation still needed recording, and found one additional
repository/remote identity-binding gap. `probe_github.py` now requires the
sanitized remote owner/repository to match the API-selected repository and has an
unrelated-remote negative assertion. Assessment classified both surviving
findings as `CONFIRMED`/`FIX`; both are resolved in this delivery. Primary
runtime and repository evidence remains authoritative.

## Tool/sub-workflow inventory

One optional version attempt, `taskfleet --version`, exited nonzero because
Taskfleet uses the `taskfleet version` subcommand. The documented subcommand then
succeeded and supplied version/commit/schema evidence. The `ssh -T
git@github.com` authentication handshake exited 1 after its explicit success
message because GitHub offers no shell; this is the expected successful handshake
convention, not an incomplete probe.

The optional `/assess-models` corpus append failed after the complete review:
the helper's bounded SSH write to `alder` returned permission denied (exit 3).
`review-tool-failures.log` preserves the redacted command, impact, and safe retry.
No repository or machine credentials were changed. This does not affect the
independently preserved review, local assessment, probe evidence, or validation;
the model-performance corpus entry alone is absent. No required tool or
sub-workflow failed or remains incomplete.

## What later work needs

`prepare-ui-review` should integrate the observed boundaries, while preserving
proposal/unknown labels. `define-host-contracts` must define descriptor-safe path
validation, the sparse annotation schema and corruption behavior, operation
stage/error envelopes, and authoritative re-snapshot behavior. The workspace,
GitHub, worktree, and archive implementation issues should turn the later tests
above into fixtures before claiming M2–M6. None of this result demonstrates a
product implementation or authorizes deployment.
