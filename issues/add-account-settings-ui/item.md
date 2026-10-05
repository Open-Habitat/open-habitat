---
created: 2026-09-27
updated: 2026-10-05
type: improvement
status: done
priority: high
related: ['@design-first-use-onboarding', '@build-history-view', '@account-profile-from-github', '@align-settings-design', '@align-navigation-design', '@browser-logout-cleanup', '@decide-account-display', '@show-pi-status-in-settings']
lane: account-ui
collision: [web/src/app/App.tsx, design-system/]
commits:
- hash: 4226d06
  summary: Add account shelf and snapshot-backed GitHub settings
- hash: 88c314c
  summary: Exercise web logout through account menu in workspace journey
closed: 2026-10-05
closed_by: jari
---

# Account menu and native GitHub settings

## Goal

Provide an account menu and settings view for native GitHub state, appearance
and browser logout. The OpenAI status and person-facing profile are tracked
separately.

## Current implementation

At `94b6b57`, the account menu and settings page are implemented in
`web/src/components/Account.tsx`, with navigation through `web/src/app/App.tsx`.
The person can change the theme, see the native GitHub connection state and
sign out. Settings shows an explanation of the native credentials remaining
on the server after logout; there is no native disconnect action.

The account still reads “Oma tili” in both the rail and settings. There is no
email or profile image, and the snapshot contract carries no person-facing
profile fields.

The design includes GitHub and OpenAI under “Yhteydet tällä palvelimella”,
but only GitHub is shown. Pi's status contract reports `usable`, `missing` or
`unknown`. It supplies neither the OpenAI account identity nor the result of
a live provider request. The settings browser test currently expects the
OpenAI row to be absent.

## Scope and acceptance

Jari confirmed on 5 October that he had personally viewed and tested the
existing account/settings UI and found it satisfactory. The earlier synthetic
screenshots are supporting evidence, not the only visual assessment.

This issue closes for the delivered account menu, GitHub settings, theme and
browser logout. The OpenAI entry remains to be implemented in
@show-pi-status-in-settings. Person-facing name, email, image and onboarding
fallback belong to @account-profile-from-github; @align-settings-design owns
layout and comparisons, and @align-navigation-design owns the rail. Closing
this issue does not claim those separate features or live provider verification.

## Acceptance Criteria

- [x] The account menu and settings provide GitHub native state, theme choice and browser logout with tested navigation and keyboard behavior.
- [x] Jari has viewed and tested the current account/settings UI and considers this slice satisfactory.

## Resolution

### 2026-10-05T13:27:17Z · @jari

Jari confirmed on 5 October that he had viewed and tested this UI and it is satisfactory. Native Pi/OpenAI status is tracked in @show-pi-status-in-settings; profile data and design alignment remain in their separate issues.
