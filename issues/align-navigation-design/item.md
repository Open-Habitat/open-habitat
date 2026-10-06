---
created: 2026-10-01
updated: 2026-10-06
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 14
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@restore-v2-conversation', '@show-pi-dialogs', '@unify-ui-primitives']
preparation: ready
closed: 2026-10-06
closed_by: claude
---

# Align navigation with the design

## Purpose and design

Make moving between workspaces and conversations and returning to unfinished
work feel like one coherent interface. Earlier technical checks passed while
the implementation's composition drifted from the design; success here includes
showing how the actual views match the intended layout.

Jari approved the navigation and settings composition now maintained in
[the navigation draft](../../design-system/drafts/Navigaatio%20ja%20asetukset.dc.html).
The [shared design](../../design-system/design.md) supplies the agreed behavior
and state meanings. The draft demonstrates composition with synthetic data;
its proposed component APIs and prototype state handling do not define the
application. The [handoff](design-package/HANDOFF.md) records the response's
corrections and remaining gaps, alongside the original
[request](design-package/REQUEST.md) and [package delivery](design-package/RESULT.md).

## Scope

Fit the expanded sidebar, collapsed rail, phone drawer, workspace page, account
menu and return view to this design on desktop and phone in both themes.
Navigation includes workspace and conversation rows, Etusivu and the account
trigger. The workspace name opens its page; a separate disclosure control
expands its conversations. The return view brings attention, ongoing work and
recent conversations into a useful order.

Current location, agent state and attention communicate different things.
“Odottaa” means an open agent waiting for a reply; visiting clears its attention
mark, while the agent continues waiting. “Valmis” means a closed agent.
“Odottaa sinua” includes unvisited waiting conversations and newly observed
errors. Visiting an error removes its attention placement, while the error
remains visible on the conversation row. Read-only access still exists and
needs a distinct presentation from waiting. Labels follow facts the host can
establish: a live process alone does not prove activity, and lost observation
does not prove failure or closure.

Use the shared components and tokens from @unify-ui-primitives and
@migrate-bespoke-controls. Agent-state meanings come from @refine-agent-status;
@design-control-states and @apply-control-state-design own their shared visual
presentation. @account-profile-from-github owns profile data and missing-data
behavior; this issue places the compact first-name/image presentation and the
opened account view with email in navigation. @align-settings-design implements
the settings layout from the same design round. Pi-block design belongs to
@design-pi-event-blocks.

Preserve the [usage flows](../../docs/product.md): returning retains the draft
and reading position, background updates retain focus, and conversations and
unresolved send outcomes remain available. @recover-sends-after-disconnection
owns concise send-error feedback, blocking sends during lost server connectivity
and automatically checking the previous send on recovery. Its receipt handling
and sending behavior are separate from this layout work.

## Demonstrating the result

Compare production views with the maintained draft in the synthetic lab, using
matching content, state, theme and viewport so layout differences are visible.
Include attention, ongoing and recent conversations and read-only use. Keep
comparisons and remaining differences here for Jari's visual review, following
[the design process](../../design-system/process.md). Production components and
their catalog examples should express the same design.

## Acceptance Criteria

- [x] Navigation, workspace page, account menu and return view follow the shared design on desktop and phone in both themes.
- [x] Shared controls, agent-state presentation and account profile are consistent, and navigation preserves drafts, reading position and focus.
- [x] Production-versus-draft comparisons show the implemented views and identify remaining differences and coverage gaps.
