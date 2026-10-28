---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-28/admin-add-before-first-sign-in
lane: admission-ui
preparation: ready
---

# Cannot make someone an administrator before they have signed in

## Description

Jari 2026-10-28 (Birch ja Contoso, pilot.13): Ylläpitäjiä ei saa lisättyä, ellei käyttäjä ole jo kirjautunut. Ylläpitäjän pitäisi voida nimetä etukäteen (GitHub-nimellä tai ID:llä), ja rooli sitoutuu ensimmäisellä kirjautumisella samaan tapaan kuin site.jsonin julistetut ylläpitäjät (declared-admin-binds-at-sign-in: deferred_until_bound).

## Acceptance Criteria

- [ ] Selaimen ylläpitäjä voi nimetä vielä kirjautumattoman ylläpitäjäksi; rooli sitoutuu ensimmäisellä kirjautumisella; testi
