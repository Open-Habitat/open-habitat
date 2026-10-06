---
created: 2026-10-01
updated: 2026-10-06
type: task
reporter: jari
status: in-progress
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 15
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@align-navigation-design', '@unify-ui-primitives']
preparation: ready
---

# Align settings with the design and refresh view comparisons

## Purpose and design

Make settings a coherent place to recognize the signed-in account, understand
native connections on this server, choose the theme and leave the browser session.
Earlier technical checks passed while the views drifted from the design; this
work also gives Jari a current comparison of the interface as a whole.

The visual target is the approved
[navigation and settings draft](../../design-system/drafts/Navigaatio%20ja%20asetukset.dc.html),
with behavior defined in the [shared design](../../design-system/design.md).
The joint round's [handoff](../align-navigation-design/design-package/HANDOFF.md)
records the accepted direction and remaining gaps and links the original request
and delivery. Its prototype logic and proposed component APIs are examples,
not application requirements.

## Settings

Fit Tili, Yhteydet tällä palvelimella, Ulkoasu and Istunto to this design on
desktop and phone in both themes. Build on the shared controls and state
presentation from @unify-ui-primitives and @migrate-bespoke-controls, keeping
production components and their catalog examples consistent. @align-navigation-design
owns the surrounding navigation; settings, the account menu and the sidebar
should present the same person and use the same controls.

@account-profile-from-github owns profile data, shared account presentation and
missing-data behavior. @add-account-settings-ui owns native connection
functionality, including the OpenAI entry. This issue arranges those elements.
Unknown connection status stays understandable rather than implying a verified
connection. Browser logout ends the browser session while native credentials
and agent work remain on the server; its presentation makes that effect clear.
Theme selection, keyboard access, focus and return navigation remain usable
through the layout change.

## Demonstrating the result

Refresh settings, navigation and conversation comparisons from one implementation
revision so Jari can judge how the views fit together. Use the current drafts
and matching content, state, theme and viewport, following the
[design process](../../design-system/process.md) and
[synthetic lab guidance](../../web/AGENTS.md). Include ongoing, completed and
read-only conversations, connection problems and account settings on desktop
and phone in both themes. This is evidence of the interface, not real-provider
behavior.

Keep the comparison index and results in this issue, with the compared revisions,
remaining differences and missing reference states visible. Gaps in the handoff,
such as a profile image or pending OpenAI sign-in example, help identify what
still needs evidence.

## Acceptance Criteria

- [ ] Settings follows the shared design on desktop and phone in both themes, using the common controls, profile presentation and native connection behavior.
- [ ] Account details, connection states, theme selection and browser logout remain understandable and usable, including keyboard navigation and missing profile or connection information.
- [ ] An updated comparison set shows settings, navigation and conversation views against the current drafts at one implementation revision, with remaining differences and missing reference states identified.
