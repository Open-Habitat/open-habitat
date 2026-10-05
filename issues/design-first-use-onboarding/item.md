---
created: 2026-09-27
updated: 2026-10-03
type: feature
status: open
priority: high
related: ['@connect-github-workspaces', '@manage-workspace-lifecycle', '@provision-first-src', '@add-pi-device-adapter', '@add-account-settings-ui', '@build-history-view']
lane: onboarding-design
collision: [docs/]
---

# Design first-use onboarding and account settings

## Goal

Make the path from browser login to useful agent work clear: GitHub login,
repository selection and checkout, then OpenAI sign-in through Pi. The user
can choose no repositories and continue. A returning user with usable Pi
credentials enters normal workspaces directly. The agreed journey and recovery
behavior are described in [plan.md](plan.md).

The visual target is the **browser design**, supplied under
[@review-browser-design-v2](../review-browser-design-v2/item.md). This issue
owns composing its onboarding screens from production components and connecting
them to the existing flow. The design review coordinates shared UI improvements;
@github-repos-first-onboarding owns repository selection and checkout behavior.

## Existing foundation

The native Pi adapter, gateway/daemon onboarding contracts, Pi access gate,
repository chooser and checkout observation already exist. Their sources and
evidence are linked in the plan. Build the remaining journey on these
components. Each report establishes only the revision and environment it tested.

## Remaining work

Fit login, repository selection and OpenAI sign-in into the design layout, with
clear progress, recovery and a way to interrupt onboarding and log out. All
repositories are visible by default, with time filtering chosen by the user.
Unverified checkout or login results remain explicit even when a draft omits
them. Returning from another browser tab should preserve the current step and
input after confirming the same web identity.

Pi owns its native credentials under the mapped Unix user. The daemon drives
the approved device-code interaction, and the browser displays the instructions;
the user does not need a Pi terminal. The first version uses a ChatGPT
subscription; API keys and other methods are later work. Pi handles token
exchange, storage and refresh. Interrupted attempts are resolved by checking
native status. Independent terminal Pi login/logout during onboarding is outside
this version's workflow; [plan.md](plan.md) describes recovery.

Normal workspaces, history and agent
control require usable Pi credentials. The narrow first-use GitHub list/checkout
path is the agreed exception. `~/src` is prepared during setup; inability to
read it is different from an empty directory.

@add-account-settings-ui owns the account menu and integration settings.
@decide-account-display specifies first name in the normal view and signed-in
email in the expanded account view. Web logout, native GitHub disconnect and
Unix-account removal are separate actions; their consequences belong beside
the relevant action. The later account-settings review resolves remaining
name/email sources and connection controls.

## Acceptance Criteria

- [ ] The onboarding screens deliver the agreed GitHub → repositories →
  OpenAI journey using the existing native integrations and shared UI.
- [ ] First use, returning users, empty selection, interrupted sign-in and
  uncertain or partial checkout have understandable recovery without false
  success or repeated uncertain writes.
- [ ] Visual and functional evidence covers the resulting screens, with live
  provider and installed-host results distinguished from synthetic tests.

[TESTING.md](../../TESTING.md) describes validation. Real-provider and
installed-host observations occur during normal consented use; record concrete
defects as issues rather than treating an old pilot checklist as approval or
as a prerequisite for this design. Visual feedback is collected for this UI
without blocking unrelated work.
