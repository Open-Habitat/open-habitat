---
created: 2026-10-01
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 15
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@align-navigation-design', '@unify-ui-primitives']
---

# Align settings with the design and refresh view comparisons

## Purpose

Settings should follow the shared [design](../../design-system/design.md), with
clear sections for Tili, Yhteydet tällä palvelimella, Ulkoasu and Istunto. Jari's
earlier review found that technically working views had drifted from the design.
Alongside fitting settings, refresh the view comparisons so he can assess the
resulting interface as a whole.

## Settings

Fit the account details, native connection rows, theme selection and browser
logout to the current design and `design-system/drafts/`, on desktop and phone
in both themes. Use the shared controls and row layouts from
@unify-ui-primitives and @migrate-bespoke-controls, with their shared state
presentation. Views arrange components; component variants and tokens own their
appearance and feedback.

@account-profile-from-github supplies the profile data and shared account
presentation, including the agreed missing-data behavior. @add-account-settings-ui
owns the remaining native connection functionality, including the OpenAI entry.
This issue fits those elements into the settings layout. Connection states
reflect the available native facts; unknown status remains understandable.
Browser logout closes the browser session while native credentials and agent
work remain on the server. The layout preserves that distinction.

Coordinate the surrounding navigation with @align-navigation-design so settings,
the account menu and the sidebar use the same account presentation and controls.
Keep theme selection, keyboard access, focus and return navigation working as
the presentation changes. Shared production components and their catalog examples
should show the same design in both themes.

## View comparisons

Capture the resulting settings and refresh the existing conversation and
navigation comparisons in the synthetic lab. Use the current drafts and one
current implementation revision so the set shows how the views fit together,
rather than mixing captures from different stages of the work. Representative
content should make the relevant states visible, including work in progress,
completed and read-only conversations, connection problems and account settings.

Keep the comparisons and their index in this issue, with the source revision and
remaining differences. Cover desktop and phone in both themes; where the designer
has not supplied a corresponding draft state, identify that gap. The lab approach
is described in `web/AGENTS.md`. The comparisons let Jari judge fidelity and choose
further refinements; they do not establish real-provider behavior.

## Acceptance Criteria

- [ ] Settings follows the shared design on desktop and phone in both themes, using the common controls, profile presentation and native connection behavior.
- [ ] Account details, connection states, theme selection and browser logout remain understandable and usable, including keyboard navigation and missing profile or connection information.
- [ ] An updated comparison set shows settings, navigation and conversation views against the current drafts at one implementation revision, with remaining differences and missing reference states identified.
