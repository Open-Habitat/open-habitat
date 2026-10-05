---
created: 2026-09-27
updated: 2026-10-05
type: feature
status: open
priority: high
related: ['@connect-github-workspaces', '@provision-first-src', '@add-pi-device-adapter', '@add-account-settings-ui', '@github-repos-first-onboarding', '@account-profile-from-github', '@decide-account-display']
lane: onboarding-design
collision: [docs/]
preparation: reviewing
---

# Design first-use onboarding

## Problem

On the first real pilot login on 27 September 2026 Jari landed on an empty
workspace view with `~/src puuttuu`, a generic unknown-state warning although
native `gh` was verified, a numeric GitHub identity in the sidebar and no way
to bring repositories in or to sign Pi in. The person who has just signed in
needs a short, understandable path to a working agent, and when something on
that path is uncertain, the screen must say so instead of reporting success.

## The agreed journey

After GitHub login, the first screen lists the person's GitHub repositories
and they choose which to check out into `~/src`. All repositories are visible
by default; a time filter is the person's own choice (Jari, 30 September,
overriding the monthly default in the delivered draft). One Continue action
checks out the selection and shows progress; choosing nothing continues
without a checkout. Native `gh`, Git and the filesystem decide access and
results, and a matching existing checkout is not cloned again
(Jari, 29 September; @github-repos-first-onboarding owns this step).

The next screen connects the person's ChatGPT subscription through Pi. The
person's own daemon starts Pi's native device-code login as that Unix user; the
browser shows the verification link, the code and the wait; the person
confirms on the provider's page. Pi exchanges, stores and refreshes the tokens
itself. The host builds no credential broker and nothing credential-bearing
reaches the gateway or the browser. API keys and other sign-in methods are
later work (Jari, 27 and 28 September; @add-pi-device-adapter delivered the
adapter).

Workspaces, history and agent control open only once a native status check
shows usable Pi credentials. The GitHub chooser and checkout before Pi are the
one exception. A returning person with usable credentials goes straight to
workspaces, also when `~/src` is empty; there is no separate "onboarding
complete" record, because current native state already says what can open.
`~/src` is created at provisioning (@provision-first-src), so a missing or
unreadable directory is a setup problem, not an empty list.

Onboarding can be interrupted and the person signed out of the browser. Browser
sign-out leaves workspaces and native credentials on the server; native
disconnect is an account-settings action. When GitHub provides no name or
email, onboarding asks for them (Jari, 1 October, in @decide-account-display);
this issue places that question in the frame, @account-profile-from-github
supplies the data.

## Recovery

The principle: the browser shows what the host can establish and never repeats
an uncertain write on its own. A lost checkout reply is resolved by read-only
observation of `~/src`; if that also fails, the screen says the result is
unverified and offers another check. A delayed device code is still being
prepared, not an error. A daemon or attempt that stops is reported as
interrupted, and Pi's native status is read before a new attempt is offered.
Returning from the provider's tab proves nothing by itself. Independent
terminal Pi login or logout during web onboarding is outside this version
(Jari, 28 September). [docs/product.md](../../docs/product.md) and
@github-repos-first-onboarding state the concrete cases.

## Remaining work

The chooser, checkout, observation, Pi adapter and access gate exist
(`web/src/app/GitHubOnboarding.tsx`, `web/src/app/PiOnboarding.tsx`). What
remains is composing the three screens from the production components to the
[design](../../design-system/design.md) and its
[onboarding draft](../../design-system/drafts/Onboarding.dc.html): the shared
frame with product, server and the steps GitHub → Repot → OpenAI, whole-row
repository choice, the code presentation and the calm interruption action whose
confirmation explains the sign-out. Where the draft omits an uncertain or
partial state, the state stays visible and the deviation is recorded here.

The target is the desktop screen; the screens stay usable at phone width, and
fitting the phone draft is not part of this issue (Jari, 5 October).

Proposed, not decided: the catalog carries last push time, so a time filter
should say what it measures, and repositories without a known time stay
visible when it is on.

The 29 September synthetic lab pass ([visual-notes.md](visual-notes.md) and
the screenshots beside it) shows the pre-design state of these screens.

## Acceptance Criteria

- [ ] A new person goes from GitHub login through repository choice to a
  connected ChatGPT subscription in the browser alone, and the screens look
  like the design.
- [ ] Choosing no repositories, returning later, an interrupted sign-in and
  an uncertain or partial checkout each end in a screen that says what is
  known and what to do next, without false success or a repeated write.
- [ ] Jari has seen the resulting screens in both themes, and live-provider
  observations are recorded as defects in their own issues rather than as
  a prerequisite checklist here (Jari, 5 October).
