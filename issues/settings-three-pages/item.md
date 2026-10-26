---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: open
priority: normal
lane: ui-impl
lane_seq: 2
collision: [web/src/app/, web/src/components/Account.tsx, docs/]
preparation: ready
blocked_by: ['@sidebar-now-aakkoset']
---

# Settings: Tekoäly, Koodipalvelut and Tiedot agenteille pages

## Description

Implement Jari's accepted settings grouping (proto-integration-grouping, round 1 'Kolme sivua', round 2 'Ponnahdus' for API keys per provider; Decisions in the issue): three pages replacing Agentit/Yhteydet/Integraatiot person pages, links from the model selector, onboarding and elsewhere going to the right page and row, GitHub and Gitea logos. The default-model row and its popover follow round 3 of the prototype when Jari has chosen; until then keep today's selector behaviour on the Tekoäly page.

## Acceptance Criteria

- [ ] Three pages as accepted; every entry point lands on the right page/row; browser tests; screenshots for Jari.

