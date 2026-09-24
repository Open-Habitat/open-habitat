---
created: 2026-09-20
updated: 2026-09-24
type: task
status: testing
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 30
blocked_by: ['@build-design-system', '@integrate-designer-rail']
collision: [docs/, AGENTS.md, design-system/]
review_status: approved
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

- [x] Exercise two distinct mapped test identities and reject unknown mappings, cross-user daemon routing and path escapes from this first authenticated slice; final verification expands these checks.
- [x] Use the real gateway/daemon path and reusable production navigation components, not a separately implemented mock UI.

- [x] Use the implementation choices and test commands established by @plan-v1-implementation.
- [x] Authenticate a web identity, map it to one fixed Unix user and route to that user's daemon.
- [x] List immediate ~/src directories including non-Git directories and directories without workspace metadata.
- [x] Implement the accepted navigation and loading/empty/error views with no workspace registry or separate harness settings.
- [x] Demonstrate the real end-to-end path and automated checks appropriate to routing and directory access.

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

## Comments

### 2026-09-24T03:21:36Z · @jari

Visual review changes requested on 2026-09-23. The browser implementation does not match the accepted design-tool compositions. In the “Login before provider selection” view, “Kirjaudu jatkaaksesi” is much too large, the general typeface is not the agreed one, and the card is excessively narrow and aligned at the far left. Similar typography, sizing, width, alignment, and composition problems recur in the other views. Provide an interactive review environment and bring the production UI back into visual parity before requesting acceptance again.

### 2026-09-24T04:06:09Z · @jari

Visual review feedback, 2026-09-24: the corrected "Login before provider selection" looks good. The "Authenticated workspace details and navigation" still does not resemble the accepted design draft; in particular the left-hand rail is unacceptable. This is a changes request, not acceptance of the workspace slice. Jari proposes giving the designer a ZIP containing the accepted design draft and the relevant production UI source so the designer can implement the visual match. The packaging/transfer is a proposal pending agreement; do not close this issue or advance dependent ui-v1 work.

## Decisions

### 2026-09-24T05:11:16Z · @jari

Visual decision 2026-09-24: Jari approves the external designer correction to the left navigation rail, shown in the new ready capture at issues/build-workspace-slice/assets/ready.avif. Approved artifact: corrected product implementation c7f27394d39291d753a50b656becaa1b4a93885c (landed in main as c7f2739 or rebased equivalent; evidence in visual-acceptance.md). Jari previously said the corrected login looked good. This decision accepts the rail correction, not yet the full login-to-workspace slice or an interactive pilot; keep this parent in testing pending the separate full-slice decision after a safe test environment exists.

### 2026-09-24T10:41:12Z · @jari

2026-09-24: Jari reviewed the corrected six-image workspace visual package in Glasspad and explicitly replied “kuvat ovat ok. Jatketaan devaamista” after seeing the corrected asset links. Accepted visual presentation at product revision c7f27394d39291d753a50b656becaa1b4a93885c (landed correction run 01m38q0xn2q7qm6n7cyxhy8046); this approves the pictured login/workspace and empty/error/partial states for this UI checkpoint only. It does not approve live OAuth, a manual authenticated product URL, Pi control, or deployment; those remain subject to their own gates. Evidence: visual-acceptance.md and its six assets.

### 2026-09-24T10:41:30Z · @agent

2026-09-24 clarification: the preceding screenshot acceptance approves the corrected visuals only. The earlier Jari decision (2026-09-24T05:11:16Z) explicitly withheld acceptance of the full login-to-workspace slice until a safe interactive review environment and a separate full-slice decision. The brief close was reversed before commit or any dependent worker was spawned. Keep testing until Jari explicitly resolves that remaining condition.
