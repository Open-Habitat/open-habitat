---
created: 2026-11-09
updated: 2026-11-09
type: task
reporter: jari
status: open
priority: normal
lane: notices-proto
lane_seq: 1
preparation: pending
---

# Design and prototype: one consistent system for warnings and notices

## Description

Jari 9.11.2026: warnings and notices are inconsistent. Some situations get the
tidy red warning bar with a close control (the shared `WarningBanner`),
others a bare text line above the field, a grey line below the field that
vanishes after a moment (*Viestiä ei lähetetty: Odota vahvistettua
joutotilaa …*), a neutral info box (*Ei tiedossa, saiko agentti viestin*),
dashed bubbles with status words, chips with *?*. They appear in different
places and look different every time, and some work at cross purposes.

1. Inventory every warning, error and notice the product can show (grep the
   catalogs and components: `WarningBanner`, notice rows, inline errors,
   toasts, status lines, bubble states), with where it appears, its look,
   lifetime, dismissal and severity. Table in result.md with screenshots of
   the worst offenders.
2. Propose one system: a small set of kinds (error, warning, info,
   progress/success?), each with one look built on `WarningBanner`, fixed
   placement rules (about this conversation's composer, about the
   conversation, about the host), lifetime and dismissal rules, and how
   two notices about the same thing must merge instead of competing.
3. Prototype round per `AGENTS-WORKFLOW.md`: today's mess on one page, then
   three directions of the system applied to the real cases (send refused,
   send uncertain, attachment refused, upload failed, quota, sign-in
   expired, history unavailable, helper/worker attention), 1440 and 390,
   light and dark.

`proto-attachment-refusal` (round 1 awaiting Jari) becomes one case of this
system; reconcile with it.

## Acceptance Criteria

- [ ] Inventory table; system proposal; prototype round 1 with view offer and questions for Jari.
