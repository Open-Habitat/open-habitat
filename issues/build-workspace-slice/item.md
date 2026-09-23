---
created: 2026-09-20
updated: 2026-09-23
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 30
blocked_by: ['@build-design-system']
collision: [docs/, AGENTS.md, design-system/]
---

# Build login to workspace navigation

## Goal

Implement the first end-to-end browser path through the gateway and per-user daemon to the real workspace directory list.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Exercise two distinct mapped test identities and reject unknown mappings, cross-user daemon routing and path escapes from this first authenticated slice; final verification expands these checks.
- [ ] Use the real gateway/daemon path and reusable production navigation components, not a separately implemented mock UI.

- [ ] Use the implementation choices and test commands established by @plan-v1-implementation.
- [ ] Authenticate a web identity, map it to one fixed Unix user and route to that user's daemon.
- [ ] List immediate ~/src directories including non-Git directories and directories without workspace metadata.
- [ ] Implement the accepted navigation and loading/empty/error views with no workspace registry or separate harness settings.
- [ ] Demonstrate the real end-to-end path and automated checks appropriate to routing and directory access.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

## Bounded planning handoff

This issue owns Y1 and the discovery/Git-gate portion of Y2. Use two synthetic identities/UIDs and the real gateway→systemd socket→daemon route. Test primary GitHub OAuth state + PKCE S256, stable numeric-ID mapping, one-time transient token forwarding, supported `gh auth login --with-token --git-protocol https` and `gh auth setup-git`, protected storage/fallback, partial states, web logout versus explicit disconnect, optional Google no-request-before-selection, session/CSRF/origin, wrong peer/socket/header, gateway home denial, symlink/path escape and token/credential/log absence. Stop before history or lifecycle writes. Exact CT IDs, commands and evidence are in [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).


## Jari visual acceptance gate

This issue is both the executable delivery and its serial human checkpoint. The worker must leave it in `testing`, not close it. While a `ui-v1` issue is in `testing`, it is a non-launchable human-acceptance hold: no round may spawn, resume or close a worker for it. Before any later `ui-v1` lane member may treat its user-visible behavior as delivered, `issues/build-workspace-slice/visual-acceptance.md` must record the exact product revision, browser/OS/environment, deterministic test fixtures, happy path and every relevant unhappy state, exact Playwright/test commands and results, and links to the essential Playwright screenshots. Screenshots are evidence, not a replacement for assertions. The conductor presents that report to Jari and records his explicit dated accept/change decision in this issue. Only the conductor may then close it; lane serialization keeps the next product slice behind this checkpoint without assigning a lane to a `human-review` issue or letting a worker self-accept.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.

## Agent Runs

### 2026-09-23T15:12:19Z · @agent

Run 01m37cpk857mh2fgwmfyyttz3a stopped correctly: it implemented only isolated directory discovery and explicitly prohibited merging the incomplete branch. The branch was discarded through audited Taskfleet cleanup. Continue this broad security slice as serial mergeable phases while the parent issue remains in-progress: (1) gateway OAuth/session/identity security core; (2) per-UID UDS, workspace discovery and native gh adapter plus two-user fixture; (3) host-backed browser integration, visual evidence, final focused security review and full gate. No phase may claim or close the complete slice before phase 3.

### 2026-09-23T16:00:08Z · @agent

Run 01m37ejvvmavh2x6bhbftyqewy delivered only the disposable systemd/two-UID VM prerequisite. Synthetic boot/UID/socket/permission proof and commands are in phase-2-vm-prereq.md. Parent stays in-progress with all acceptance boxes unchanged. Phase 2 still must implement and exercise the actual mapped gateway→daemon route; phase 3 owns host-backed browser/visual acceptance.
