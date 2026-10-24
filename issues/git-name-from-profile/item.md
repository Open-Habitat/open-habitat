---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: done
priority: normal
preparation: ready
lane: unlaned
closed: 2026-10-24
---

# Onboarding: prefill 'Gitissä näkyvä nimi' from the previous step's name

## Description

Jari, 2026-10-24, testing first sign-in with a new account: "Kirjautuminen toimi moitteettomasti", but the Git identity step's **"Gitissä näkyvä nimi"** should be prefilled from the name the person gave in the previous view (the account/profile name step), instead of being empty or taken from elsewhere.

Goal: the Git identity step defaults the name to the name entered in the preceding profile step (the person can still edit it); if the person skipped that, fall back to what it does today. No change to how the identity is saved.

## Acceptance Criteria

- [x] Component test and the browser onboarding spec assert the prefill; story updated.
- [x] KOKEILTAVAA line under Käyttöönoton testaaminen.
