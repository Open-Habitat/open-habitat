---
created: 2026-09-20
updated: 2026-09-21
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
labels: [external-input]
---

# Receive the external designer UI v1 artifacts

## Goal

Collect the designer output that Jari is commissioning, without starting a duplicate design worker.

## Context

On 2026-09-20 Jari said he is putting the designer to work. No output has been received yet. This is external work coordinated by the user, deliberately without an executable lane. Do not automatically assign another agent, contact the designer, or mark this complete based on elapsed time. Handoff files are native-agent-host-ui-01-workspaces.zip and native-agent-host-ui-02-conversation.zip in Rowan Downloads.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [x] Record stable artifact links or place received files under this issue directory, with the brief revision they implement.
- [ ] Collect the conversation first-draft direction and record Jari's feedback before treating the full design as accepted.
- [ ] Collect the v1 conversation states and the surrounding host/workspace views, including desktop/mobile and any missing states.
- [ ] Mark delivery complete when artifacts are available for the separate review issue; delivery alone is not design acceptance.

## Comments

### 2026-09-20T08:34:12Z · @pi

Keskustelukäyttöliittymän v0.1-toimitus vastaanotettiin ja purettiin projektin design-system/-hakemistoon. Zipiä ei säilytetä repossa; lähdepolku, SHA-256, vedokset ja alustava arvio ovat review.md:ssä. B1–B10, B12 ja B5a–B5f ovat mukana; B11 on rajattu pois. Toimitus ei sisällä mobiilivedoksia ja se lisää alkuperäisen v1-rajauksen ulkopuolelta viestijonon sekä kesken vuoron ohjauksen. Jarin hyväksyntää tai korjauspyyntöjä ei ole vielä kirjattu, joten issue jätetään in-progress-tilaan.

### 2026-09-21T10:19:32Z · @pi

Päivitetty workspace-/navigointipaketti native-agent-host-ui-01-workspaces-v2.zip on nyt ulkopuolisella designerilla työn alla. Kun toimitus valmistuu, se vastaanotetaan puhtaassa agentti-istunnossa tämän issuen alle ja katselmoidaan yhdessä keskusteludesignin kanssa. Älä käynnistä rinnakkaista design-agenttia odotusaikana.
