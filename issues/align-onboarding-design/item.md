---
created: 2026-10-05
updated: 2026-10-06
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-05:first-use-onboarding-rethink
originating_run: 01m45vh37hqns995zyag093677
originating_run_kind: spinoff
preparation: ready
related: ['@design-first-use-onboarding', '@align-navigation-design', '@align-settings-design', '@account-profile-from-github', '@github-repos-first-onboarding']
collision: [web/, design-system/]
lane: design-v2
blocked_by: ['@account-profile-from-github']
closed: 2026-10-06
closed_by: claude
---

# Align onboarding with the design

## Purpose

Bring the working first-use journey into the current design without changing
its behavior. After GitHub login, the person chooses repositories to check
out into `~/src` and connects their ChatGPT subscription through Pi's native
device-code login. @design-first-use-onboarding records the product decisions;
[the usage flows](../../docs/product.md) describe the behavior and recovery.

## Scope

Compose the sign-in, repository and OpenAI screens from shared controls and
design tokens. The [onboarding draft](../../design-system/drafts/Onboarding.dc.html)
and the Käyttöönotto section of [design.md](../../design-system/design.md)
describe the target. Both themes follow the desktop design. Phone widths remain
usable, but fitting the phone draft is outside this round.

All repositories are visible by default; time filtering is the person's
choice, not the monthly default shown in the draft. Preserve session binding,
checkout observation and device-code polling: an interrupted sign-in, uncertain
checkout or partial result still needs an honest presentation even where the
draft has no example. @account-profile-from-github supplies the profile data
and missing-name-or-email question; this work places that question in the
onboarding frame.

The [design round](../../design-system/process.md) describes how to compare the
composed screens with the draft. Keep the comparison and its index in this issue
folder so Jari can review both themes, including uncertain and partial states,
and understand any departures from the draft.

## Acceptance Criteria

- [ ] The onboarding screens use the shared components and match the agreed desktop design in both themes, with all repositories visible by default, while remaining usable at phone width.
- [ ] Missing profile information can be supplied in the onboarding frame; interrupted sign-in, uncertain checkout and partial results remain visible with their existing recovery behavior.
- [ ] The lab comparison demonstrates fidelity to the agreed design, and Jari has reviewed the screens. Differences are corrected or agreed with Jari and recorded with their reasons; no unresolved design differences remain.
