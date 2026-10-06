---
created: 2026-10-02
updated: 2026-10-06
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:7-8
related: ['@decide-account-display', '@align-navigation-design', '@align-settings-design']
blocked_by: ['@unify-ui-primitives']
lane: account-ui
lane_seq: 20
preparation: ready
closed: 2026-10-06
closed_by: claude
---

# Make the signed-in account recognizable across the UI

## Problem

Jari reported on 2 October 2026 that the account still reads "Oma tili" and
Settings has no email, and asked for the GitHub name and profile image. The
interface does not clearly tell the person whose account they are using.

## Agreed behavior

Show the person's first name in the compact account view and their email when
the account view is opened. GitHub is the source; onboarding asks for the name
or email if GitHub does not provide it, as decided in @decide-account-display.
The first name is not guessed from an email address. Use the GitHub profile
image to help the person recognize their account, with a usable presentation
when no image is available.

These are display details. The existing authenticated identity and Unix-user
binding determine whose account and data the person can access; entering an
email during onboarding does not change that identity.

## Work

Trace how GitHub profile information reaches the application and supply the
missing data and onboarding fallback. The sidebar, account menu and settings
should use a shared account presentation so they consistently describe the same
signed-in person. This includes the browser/host contract and profile data flow,
not just replacing a label in one view.

Build the account presentation from the shared controls in @unify-ui-primitives
and the [design](../../design-system/design.md). @align-navigation-design owns the
surrounding sidebar layout and @align-settings-design the settings layout;
@add-account-settings-ui owns the remaining native connection settings. Those
views consume the profile information and shared account presentation from this
work.

## Acceptance Criteria

- [x] The sidebar, opened account menu and settings identify the same signed-in person using the agreed name, email and profile image presentation.
- [x] Missing GitHub name or email can be supplied during onboarding, and the account remains recognizable without a profile image.
- [x] After logout and signing in as another person, the views show that person's profile. Display information does not change authenticated identity or Unix-user binding.
