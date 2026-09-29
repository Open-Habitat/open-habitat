# Implementation ownership

The browser should let a person work with their native Pi conversations and
workspaces under their own Unix account. This map identifies the issue responsible
for each part of that experience. Issuectl owns status, dependencies and scheduling;
the linked issues own implementation scope and verification.

## Where implementation details live

- [Architecture](../../docs/architecture.md) and the ADRs define component authority.
- [Interfaces](../../docs/interfaces.md) and [contracts](../../contracts/v1/AGENTS.md)
  define messages and their meaning.
- [Production design](../../design-system/production-v1.md) and the
  [component catalog](../../design-system/component-catalog-v1.md) guide shared UI.
- [Local checks](../../scripts/AGENTS.md) describe the executable clean gate.
- Test plans and results belong to the implementing issue. Concrete installation,
  upgrade and rollback procedures belong to Fleetrepo's test-installation runbook.

Buffers and limits need a concrete purpose. Prefer the simplest implementation
that keeps normal use responsive and reliable; do not build retention machinery
merely to satisfy earlier numeric proposals. Choose and adjust limits from
measurements and observed use. The interface specification describes recovery
when a retained result is no longer available.

## Product work

### `build-app-foundation`

[Application foundation](../build-app-foundation/item.md) owns the runnable
application shell, build, generated contracts, package and local clean gate.
Use the existing implementation and checks as the starting point.

### `build-design-system`

[Shared components](../build-design-system/item.md) owns reusable controls and
their accessible behavior. The application and Storybook use the same production
components, so review examples show what users actually get.

### `build-workspace-slice`

[Workspace browsing](../build-workspace-slice/item.md) connects authenticated
identity to the user's daemon and native workspace list. First-login account
creation follows [ADR 0004](../../docs/adr-0004-first-login-user-provisioning.md);
the gateway does not create accounts or run native tools.

### `build-history-view`

[Native history](../build-history-view/item.md) lets the user read Pi conversations,
including long and unfamiliar tool output, directly from Pi's history.
Opening history does not start a writer.

### `build-agent-control`

[Agent control](../build-agent-control/item.md) starts browser conversations,
continues ended browser conversations, sends messages and shows live work over
SSE. Browser disconnect leaves Pi running; interruption and uncertain sends are
shown honestly. Terminal histories remain read-only.

### `complete-conversation-ui`

[Conversation UI](../complete-conversation-ui/item.md) completes tool grouping,
code and diffs, copying, titles, queue/steering controls and accessible navigation.
Drafts, focus and reading position survive updates. Pi-specific question dialogs
are outside the current scope.

### `manage-workspace-lifecycle`

[Workspace lifecycle](../manage-workspace-lifecycle/item.md) covers local creation,
settings, visibility, Git integration and deletion. Partial results reflect the
filesystem and native tools; deletion must stay within the intended workspace.

### `connect-github-workspaces`

[GitHub workspaces](../connect-github-workspaces/item.md) covers repository creation
and checkout through the user's native gh/Git configuration. Remote creation,
origin setup and push have independently observable outcomes.

### `manage-agent-worktrees`

[Agent worktrees](../manage-agent-worktrees/item.md) starts and follows
Taskfleet-owned work. Taskfleet creates and removes its worktrees; the host
does not infer ownership from a branch name.

### `archive-agent-conversations`

[Conversation archive](../archive-agent-conversations/item.md) hides and restores
conversations through presentation metadata while retaining native history.
Stopping work, archiving and continuing a conversation are separate actions.

### `prepare-mvp-operations`

[Installation and recovery](../prepare-mvp-operations/item.md) owns portable
release artifacts and generic self-hosting guidance. Fleetrepo owns the concrete
test installation and its verified upgrade/rollback procedure.

### `verify-v1-resilience`

[Integration verification](../verify-v1-resilience/item.md) checks delivered flows
across browser, gateway, daemon and native tools, especially disconnects, restart,
isolation and recovery. Findings drive focused fixes; this is not a final
whole-product acceptance gate.

## Contract-scenario implementation ownership

[Scenarios](../../contracts/v1/scenarios.json) describe the behavior to verify.
The assigned issue owns its tests; a catalogue entry alone is not runtime proof.
CT-025 and CT-033, which required Pi question dialogs, are retired.

| Scenarios | Implementing issue |
|---|---|
| CT-001, CT-002, CT-023, CT-026 | [build-workspace-slice](../build-workspace-slice/item.md) |
| CT-027 | [build-app-foundation](../build-app-foundation/item.md) |
| CT-013 | [build-history-view](../build-history-view/item.md) |
| CT-003, CT-004, CT-005, CT-006, CT-007, CT-008, CT-009, CT-010, CT-011, CT-022, CT-028, CT-030 | [build-agent-control](../build-agent-control/item.md) |
| CT-012, CT-014, CT-015, CT-031 | [complete-conversation-ui](../complete-conversation-ui/item.md) |
| CT-016, CT-017, CT-020, CT-024, CT-029 | [manage-workspace-lifecycle](../manage-workspace-lifecycle/item.md) |
| CT-018, CT-032, CT-034 | [connect-github-workspaces](../connect-github-workspaces/item.md) |
| CT-019 | [manage-agent-worktrees](../manage-agent-worktrees/item.md) |
| CT-021 | [archive-agent-conversations](../archive-agent-conversations/item.md) |
| CT-035 | [gate-native-routes-on-pi](../gate-native-routes-on-pi/item.md) |

## Evidence and review

Each issue records the revision, relevant checks and what the evidence proves.
Use synthetic identities and disposable native data for automated tests; real
people participate voluntarily in their own login. UID isolation remains a
technical requirement regardless of the number of live participants.

Provide proportionate screenshots for user-visible changes and record Jari's
verdict when given. Unreviewed appearance remains unreviewed, but it does not
block functional completion or independent work. Run
`./scripts/ci-local.sh --clean --json` before landing.
