---
created: 2026-11-27
updated: 2026-11-27
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/kayttoonotossa
lane: unlaned
preparation: ready
---

# Integration state pill 'Käyttöönotossa' reads as an unfinished setup

## Description

Jari 27.11.2026, reviewing the Entra prototype round 4: the integration row's
state pill "Käyttöönotossa" (Settings › server integrations, text
`inOnboarding` / `inOnboardingHidden` in `web/src/text/serverIntegrations.tsx`,
English "In onboarding") is misleading. It reads as if the administrator's own
setup process were unfinished, while it actually means the service is set up
and people can connect it themselves (and it appears as a step in their
onboarding). The pill should say that the service is ready for people to take
into use, e.g. "Tarjolla" (the page already says "Tarjolla olevat palvelut
jokainen yhdistää itse"), with the onboarding detail in the hidden variant or
tooltip.
