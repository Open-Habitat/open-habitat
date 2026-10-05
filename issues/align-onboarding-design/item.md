---
created: 2026-10-05
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-05:first-use-onboarding-rethink
originating_run: 01m45vh37hqns995zyag093677
originating_run_kind: spinoff
preparation: reviewing
related: ['@design-first-use-onboarding', '@align-navigation-design', '@align-settings-design', '@account-profile-from-github', '@github-repos-first-onboarding']
collision: [web/]
---

# Align onboarding with the design

## Description

# Align onboarding with the design

## Purpose

The first-use journey works: after GitHub login the person chooses
repositories, they are checked out into `~/src`, and the ChatGPT subscription
is connected through Pi's native device-code login
(@design-first-use-onboarding records the decisions,
[the usage flows](../../docs/product.md) the behavior). The screens were built
before the current design and have not been through a design round like
@align-navigation-design and @align-settings-design. Jari decided on
5 October 2026 to close the product issue and carry the screens through this
round on their own.

## Design sources

The [design](../../design-system/design.md) section Käyttöönotto and the
[onboarding draft](../../design-system/drafts/Onboarding.dc.html) are the
target: the shared frame with product, server and the steps
GitHub → Repot → OpenAI, whole-row repository choice, the code presentation
and the calm interruption action whose confirmation explains the sign-out.
All repositories are visible by default; the time filter is the person's
choice. The draft starts with a monthly filter on; that does not govern.

The desktop screen is the target. The screens stay usable at phone width, but
the phone draft is not fitted in this round (Jari, 5 October).

## Work

Compose the sign-in, repository and OpenAI screens from the shared controls
(@unify-ui-primitives) and the design tokens, in both themes. Keep the
existing state handling: session binding, checkout observation, device-code
polling and the recovery cases in the usage flows. Where the draft omits an
uncertain or partial state, the state stays visible and the deviation is
recorded here with its reason. Missing name or email is asked during
onboarding; @account-profile-from-github supplies the data and this round
places the question in the frame.

Capture the resulting screens in the synthetic lab and compare them with the
draft as the [design round](../../design-system/process.md) describes, in both
themes, with uncertain and partial states included. Keep the comparison and
its index in this issue folder.

## Acceptance Criteria

- [ ] The three onboarding screens match the draft in both themes on the
  desktop, with the agreed repository default, and remain usable at phone
  width.
- [ ] Uncertain checkout, interrupted sign-in and partial results stay
  visible on the composed screens; each deviation from the draft is recorded
  with its reason.
- [ ] Jari has reviewed the lab comparison of the screens.
