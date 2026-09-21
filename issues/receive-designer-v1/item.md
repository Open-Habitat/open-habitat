---
created: 2026-09-20
updated: 2026-09-21
type: task
status: done
priority: normal
epic: native-agent-host-architecture
labels: [external-input]
closed: 2026-09-21
closed_by: pi
commits:
- hash: c2c0be8ba0c62f56144ffaa8132cbc92d27e3332
  summary: 'docs(ui): accept the workspace MVP direction'
---

# Receive the external designer UI v1 artifacts

## Goal

Collect the designer output that Jari is commissioning, without starting a duplicate design worker.

## Context

On 2026-09-20 Jari said he is putting the designer to work. No output has been received yet. This is external work coordinated by the user, deliberately without an executable lane. Do not automatically assign another agent, contact the designer, or mark this complete based on elapsed time. Handoff files are native-agent-host-ui-01-workspaces.zip and native-agent-host-ui-02-conversation.zip in Rowan Downloads.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [x] Record stable artifact links or place received files under this issue directory, with the brief revision they implement.
- [x] Collect the conversation first-draft direction and record Jari's feedback before treating the full design as accepted.
- [x] Collect the v1 conversation states and the surrounding host/workspace views, including desktop/mobile and any missing states.
- [x] Mark delivery complete when artifacts are available for the separate review issue; delivery alone is not design acceptance.

## Comments

### 2026-09-20T08:34:12Z · @pi

Keskustelukäyttöliittymän v0.1-toimitus vastaanotettiin ja purettiin projektin design-system/-hakemistoon. Zipiä ei säilytetä repossa; lähdepolku, SHA-256, vedokset ja alustava arvio ovat review.md:ssä. B1–B10, B12 ja B5a–B5f ovat mukana; B11 on rajattu pois. Toimitus ei sisällä mobiilivedoksia ja se lisää alkuperäisen v1-rajauksen ulkopuolelta viestijonon sekä kesken vuoron ohjauksen. Jarin hyväksyntää tai korjauspyyntöjä ei ole vielä kirjattu, joten issue jätetään in-progress-tilaan.

### 2026-09-21T10:19:32Z · @pi

Päivitetty workspace-/navigointipaketti native-agent-host-ui-01-workspaces-v2.zip on nyt ulkopuolisella designerilla työn alla. Kun toimitus valmistuu, se vastaanotetaan puhtaassa agentti-istunnossa tämän issuen alle ja katselmoidaan yhdessä keskusteludesignin kanssa. Älä käynnistä rinnakkaista design-agenttia odotusaikana.

### 2026-09-21T10:26:25Z · @pi

Workspace- ja navigointitoimitus vastaanotettiin tiedostosta Palvelimet ja workspace-dokumentaatio.zip (SHA-256 598a9b7e31edf7f67078d60258050ccdb4a85014e4a1f62e4d8f8a49eb871813). Zip testattiin ehjäksi; handoff, päävedos, A1–A9-yhteenveto ja vedosten support.js purettiin design/workspaces/-hakemistoon. Alustava sovitus on review.md:ssä. Toimitus lisää rajauksen ulkopuolisia workspace-, GitHub-, A7-, worktree-, arkisto- ja poistotoimintoja sekä poistaa pyydetyn usean palvelimen tarkistuksen, joten sitä ei ole hyväksytty toteutusmäärittelyksi. Muutokset jätetään Jarin pyynnöstä commitoimatta tarkastusta varten.

### 2026-09-21T10:37:03Z · @pi

Jari hyväksyi workspace- ja agenttinavigoinnin ensimmäisen funktionaalisen MVP-version suunnaksi. Ensimmäisessä versiossa on yksi palvelin; toimituksen workspace-, GitHub-, asetus-, worktree-, arkisto- ja automaattiset toiminnot ovat tärkeitä. Agenttilistan tilailmaisua voidaan parantaa ensimmäisen toimivan version jälkeen. Puuttuva vanha vertailuvedos ei estä työtä. Toimituksen README.md normalisoitiin repo-ohjeen mukaiseksi design/workspaces/AGENTS.md-tiedostoksi ja CLAUDE.md-symlinkiksi. Design systemiä ei muutettu. Muutokset ovat edelleen commitoimatta Jarin tarkastusta varten.

## Resolution

### 2026-09-21T10:37:13Z · @pi

Both external UI deliveries are stored under the issue, Jari's MVP direction is recorded, and the remaining product/adapter review continues in @review-ui-v1 and @probe-pi-control. Delivery completion is not evidence that every mocked backend capability exists.
