---
created: 2026-09-27
updated: 2026-10-03
type: improvement
status: testing
priority: high
related: ['@design-first-use-onboarding', '@build-history-view', '@account-profile-from-github', '@restore-v2-settings', '@restore-v2-navigation', '@browser-logout-cleanup', '@decide-account-display']
lane: account-ui
collision: [web/src/app/App.tsx, design-system/]
commits:
- hash: 4226d06
  summary: Add account shelf and snapshot-backed GitHub settings
- hash: 88c314c
  summary: Exercise web logout through account menu in workspace journey
---

# Complete account and native connection settings

## Goal

Give the person one understandable place to recognize their account, see their
GitHub and OpenAI connection state on this server, choose the appearance and
sign out of the browser.

## Current implementation

At `94b6b57`, the account menu and settings page are implemented in
`web/src/components/Account.tsx`, with navigation through `web/src/app/App.tsx`.
The person can change the theme, see the native GitHub connection state and
sign out. Settings shows an explanation of the native credentials remaining
on the server after logout; there is no native disconnect action.

The account still reads “Oma tili” in both the rail and settings. There is no
email or profile image, and the snapshot contract carries no person-facing
profile fields.

The v2 design includes GitHub and OpenAI under “Yhteydet tällä palvelimella”,
but only GitHub is shown. Pi's status contract reports `usable`, `missing` or
`unknown`. It supplies neither the OpenAI account identity nor the result of
a live provider request. The settings browser test currently expects the
OpenAI row to be absent.

## Remaining work

Add the OpenAI connection entry using the available native status, with a clear
presentation when credentials are missing or their state is unknown. Use the
existing Pi onboarding path for sign-in. Update the settings test to cover the
new entry.

Use the shared account presentation from @account-profile-from-github: first
name in the compact view, email in the opened view, GitHub profile image and
onboarding fallback for missing details.

@restore-v2-settings owns the settings layout and design comparisons;
@restore-v2-navigation owns the rail. Coordinate the connection entry and shared
profile presentation with that work. Browser logout is covered by the completed
@browser-logout-cleanup issue.
