---
created: 2026-10-01
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 14
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@restore-v2-conversation', '@show-pi-dialogs', '@unify-ui-primitives']
---

# Align navigation with the design

## Purpose

The sidebar, account menu and return view should follow the shared
[design](../../design-system/design.md), so moving between workspaces and
conversations feels like part of the same interface. Jari's earlier comparison
found that passing technical checks had not preserved the design's composition.
The work needs a visual comparison of the actual views with the current drafts.

## Design round

Navigation and settings share one [design request](design-package/REQUEST.md)
kept in this issue. The [package result](design-package/RESULT.md) records
its coverage and delivery; the returned draft's [handoff assessment](design-package/HANDOFF.md)
tracks what has been agreed and what remains to check. @align-settings-design owns the settings
implementation. Shared control-state design and Pi-block design remain
separate rounds in @design-control-states and @design-pi-event-blocks;
each prepares its request from current material when its round starts.

## Work

Fit the expanded sidebar, collapsed rail and phone navigation drawer to the
design, including workspace and conversation rows, the Etusivu entry, account
trigger and menu. Fit the return view where the person resumes work, including
its running and recently opened conversations. Cover desktop and phone in both
light and dark themes.

Use the shared controls from @unify-ui-primitives and @migrate-bespoke-controls.
Views arrange those components; component variants and tokens own their visual
behavior. Agent states use the meanings from @refine-agent-status and the shared
presentation designed in @design-control-states and implemented by
@apply-control-state-design. A live process alone does not establish that an
agent is working; the views should show what the host actually knows.

Use the profile data and shared account presentation from
@account-profile-from-github: first name and profile image in the compact view,
email in the opened account view, with the agreed missing-data behavior. This
issue owns their placement in navigation. The settings layout is separate work.

Preserve the navigation behavior described in [the usage flows](../../docs/ui.md):
returning to a conversation retains its draft and reading position, and background
updates do not steal focus. Current conversations and uncertain results remain
available while the presentation changes. Drafts demonstrate composition with
simulated data; their prototype state handling is not the application's behavior.

Implementation of the sending and connection-recovery behavior agreed below belongs to
@recover-sends-after-disconnection, including the short send-error feedback
and automatic receipt check. It is separate from this navigation layout work.

## Demonstrating the result

Use the synthetic lab to compare the implemented views with
`design-system/drafts/` side by side. Choose representative content that makes
the navigation and agent states visible, including active and recent conversations
and read-only use. Keep the comparisons and remaining differences in this issue
so Jari can judge the result. Shared production components and their catalog
examples should reflect the same design.

## Acceptance Criteria

- [ ] The sidebar, collapsed rail, phone drawer, account menu and return view follow the shared design in both themes.
- [ ] The views use the shared controls, agent-state presentation and account profile consistently while preserving navigation behavior.
- [ ] Synthetic lab comparisons show the resulting views beside the current drafts and identify any remaining differences.

## Decisions

### 2026-10-05T05:31:43Z · @jari

Design response review: Jari prefers the designer’s error-forward status language to the current UI’s prominent “uncertain” messaging. A lost send acknowledgement is presented as a send error with a short instruction to check the conversation before retrying, not an extended explanation of uncertainty. Preserve the underlying distinction between confirmed rejection and unknown receipt so the UI does not claim “not sent” without evidence and never resends automatically. This changes the user-facing design, not the host receipt contract; reconcile the draft’s “ei lähetetty” label accordingly during handoff.

### 2026-10-05T05:33:45Z · @jari

Correction to the preceding decision: do not tell the person to inspect the conversation before retrying. When server connectivity is lost, the UI blocks new sends; after connectivity returns, it checks the earlier send outcome automatically before enabling a new send. Keep the visible feedback short (send error), preserve the text and never resend automatically. A broken event stream alone is not proof that server writes are unavailable. The present browser still needs implementation work to enforce the connectivity gate and replace its manual-check copy.

### 2026-10-05T08:03:19Z · @jari

Agent-state correction for this designer response: @refine-agent-status records Jari’s decision that “odottaa” is an open agent waiting for a reply, with attention cleared when the person visits, while “valmis” is a closed agent. The draft’s unread-“valmis” → seen-“odottaa” transition must not be carried into the shared design. The layout can retain separate location and attention cues, but its state labels and examples need revision.
