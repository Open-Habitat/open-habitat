---
created: 2026-09-29
updated: 2026-10-03
type: feature
status: testing
priority: high
lane: github-first-onboarding
collision: [internal/gateway/, internal/daemon/, web/src/app/App.tsx, web/src/app/PiOnboarding.tsx]
blocked_by: ['@pre-pi-github-clone', '@github-chooser-component', '@single-action-github-onboarding', '@observe-pre-pi-checkout']
---

# Choose GitHub repositories before Pi sign-in

## Goal

After browser/GitHub login, the user chooses repositories to check out into
`~/src`, then signs in to OpenAI through Pi before entering normal workspaces,
history or agent control. One explicit Continue action checks out the selected
repositories, shows progress and advances after confirmed success. With no
selection it advances directly to Pi. Native `gh`, Git and the user's filesystem
remain the sources of truth.

## Current implementation and remaining work

The chooser, pre-Pi native catalog, checkout and read-only checkout observation
are implemented. `web/src/app/GitHubOnboarding.tsx` loads the catalog, binds the
flow to the web session and verifies existing or newly created checkouts before
advancing. A user with usable Pi credentials goes straight to normal workspaces.
[The implementation report](result.md) records synthetic browser evidence;
[@observe-pre-pi-checkout](../observe-pre-pi-checkout/item.md) also records a
separate-kernel-UID check.

Finish the journey against the new
[onboarding design](../design-first-use-onboarding/plan.md). All repositories
are visible by default; the user can choose a time filter. Visual composition
belongs to @design-first-use-onboarding, with shared
UI improvements coordinated by @review-browser-design-v2.

An interrupted reply may leave a completed checkout. Observe native state
before offering another write. If observation also fails, explain that the
result could not be verified and offer another read-only check. Show which
repositories succeeded when only some did; a partial directory or conflicting
origin needs an honest explanation, not automatic removal or another clone.
The draft's success/error presentation must still express this uncertainty.

## Acceptance Criteria

- [ ] The complete first-use journey lists the mapped user's repositories,
  checks out the selected ones with one Continue action, and proceeds to Pi;
  empty selection also works. Normal workspace/history/control access stays
  behind the Pi gate.
- [ ] Returning users and interrupted or partial checkouts recover from native
  facts without duplicate writes, misleading success or cross-user data.
- [ ] The repository chooser and its failure states have visual evidence. The result
  distinguishes synthetic tests, earlier live observations and what has been
  verified on the installed release.

[TESTING.md](../../TESTING.md) defines the relevant checks. Fleetrepo owns
installation and recovery receipts. Real Pi/provider checks happen with
Jari's consent in normal use; concrete failures get their own issues.

Jari has authorized cloning his existing GitHub repositories and creating
private disposable repositories for live integration tests using his mapped
native account. Real GitHub/Pi sign-in involves Jari. Synthetic fixtures stay
separate from real accounts, and host-specific receipts stay in Fleetrepo.

## Related

@design-first-use-onboarding, @connect-github-workspaces,
@manage-workspace-lifecycle, @fix-pi-onboarding-poll-starvation
