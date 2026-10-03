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
native GitHub and OpenAI connection state on this server, choose the appearance
and sign out of the browser. Continue from the existing settings implementation
and the later account-display and v2 design decisions.

## Current implementation

Source inspection at `94b6b57` on 3 October 2026 found:

- `web/src/components/Account.tsx` already supplies the account menu, settings,
  shared theme controls and browser logout. `/settings`, return navigation and
  focus handling are wired through `web/src/app/App.tsx`.
- Settings shows the snapshot's native GitHub state, including partial and
  unknown states. It explains that browser logout leaves native credentials in
  place. There is no disconnect button or native disconnect endpoint; the old
  requirement for a disabled button no longer describes the implementation.
- Both `App.tsx` and `WorkspaceRailView.tsx` pass the literal “Oma tili”. The
  account presentation has no email or real profile image, and the snapshot
  contract has no person-facing profile fields.
- The v2 handoff includes GitHub and OpenAI under “Yhteydet tällä palvelimella”,
  but settings currently shows only GitHub. `web/tests/account-settings.spec.ts`
  explicitly expects no OpenAI row. Pi's existing status contract reports
  `usable`, `missing` or `unknown`; it does not identify an OpenAI account or
  prove that the next provider request will succeed.
- @browser-logout-cleanup now owns the implemented cleanup of conversation
  stores, connections, pending reads and person-specific browser state during
  logout and identity changes.

The original [result](result.md) and [visual evidence](visual-acceptance.md)
record the earlier slice. Its clean gate passed at `88c314c`; that report's
reference to a disabled disconnect action is historical. This inspection did
not rerun browser tests or establish visual acceptance of the current view.

## Remaining work and ownership

Complete the connection-settings behavior, including the missing OpenAI entry,
using the native observations the host can actually supply. Explain unknown or
missing state without inventing an account identity or treating saved credentials
as a successful live provider call. Reuse the existing Pi onboarding path where
sign-in is needed. The later decision in @pilot14-session-revalidation-loop
removed repeated Pi credential checks from normal workspace and history access;
showing settings does not reinstate that gate.

@account-profile-from-github owns the profile data flow and common account
presentation: first name in the compact view, email in the opened view, GitHub
profile image and onboarding fallback for missing details. This follows
@decide-account-display. Consume that shared presentation here rather than
creating another source of profile data.

@restore-v2-settings owns the settings layout and updated design comparisons;
@restore-v2-navigation owns the rail. Coordinate the functional settings work
with those issues so the same production components serve both. Phone layouts
are included in the agreed v2 scope.

Browser logout, native credential removal and Unix-account deletion have
different effects. This work uses the existing browser logout behavior. The old
disabled-control requirement does not authorize implementing native disconnect
or prescribe a fresh-authentication mechanism for it; a real credential-removal
feature needs its own agreed behavior and host support.

## Completion

The person can recognize their account through the shared profile presentation,
understand the supported GitHub and OpenAI connection observations, change the
theme and sign out through the existing browser-session action. Navigation,
keyboard focus and unavailable-state handling remain usable. The linked issues
own profile implementation and visual fitting; this issue records the remaining
connection behavior and the combined account-settings result.

Update the relevant component/browser coverage, including the assertion that
OpenAI is absent, and leave current visual evidence under the repository's UI
workflow. Use `TESTING.md` for validation. Earlier synthetic results are evidence
of those revisions, not acceptance of today's appearance or live integrations.
