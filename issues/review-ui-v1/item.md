---
created: 2026-09-20
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
commits:
- hash: c2c0be8ba0c62f56144ffaa8132cbc92d27e3332
  summary: 'docs(ui): accept the workspace MVP direction'
blocked_by: ['@receive-designer-v1', '@finalize-design-docs', '@prepare-ui-review']
labels: [human-review]
reviewer: jari
---

# Review and agree the designer UI v1

## Goal

Review the delivered UI against the bounded v1 brief and agree the implementation target with Jari.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Execution and output

This is a human review handled by the main-session conductor after @prepare-ui-review.
It intentionally has no lane. Present the concrete package to Jari; do not spawn an
unattended worker and do not infer approval from delivery or elapsed time. Record the
decision, date and reviewed revision in `review.md` here and update `docs/product.md`
and `docs/ui.md`. The already accepted workspace MVP direction stays in scope.
If corrections are required, schedule bounded accepted correction issues as blockers;
keep this issue open until the target is accepted.

## Acceptance Criteria

- [x] Check B1–B10, B12 and B5a–B5f; B11 and L1–L13 must not become v1 requirements.
- [x] Check host A1–A6, A8 and basic A9; ensure navigation and conversation form one usable flow.
- [x] Walk through sending, resume, read-only agents, grouped tools, diffs, copy, supported questions, interruption and uncertain sends/reconnect.
- [x] Record requested corrections, their resolution and explicit user acceptance of the implementation target.
- [x] Record chosen UI components and unresolved adapter requirements; a mock does not prove Pi integration.

## Comments

### 2026-09-20T08:34:12Z · @pi

Keskustelun v0.1-aineisto on vastaanotettu projektin juuren design-system/-hakemistoon ja alustava arvio tiedostoon ../receive-designer-v1/review.md. Katselmoinnissa päätettävät poikkeamat ovat erityisesti desktop-first ilman mobiilivedoksia, viestijono ja kesken vuoron ohjaus, automaattinen otsikointi sekä komponenttien saavutettavuus ennen tuotantokäyttöä. Paketin 1 päivitetty toimeksianto ja v2-zip käyttävät visuaalista suuntaa, mutta eivät tee näistä avoimista ehdotuksista backend-vaatimuksia.

### 2026-09-20T08:38:03Z · @pi

Design system siirrettiin vastaanotto-issuen alta projektin pysyväksi juuritason hakemistoksi design-system/. Issueen jäi alkuperäinen zip, checksumit ja vastaanottoarvio. Käytä katselmoinnissa ja myöhemmässä UI-työssä juuritason design-system/ polkua.

### 2026-09-20T08:51:55Z · @pi

Jarin palautteen perusteella design system erotettiin ensimmäisen keskusteludesignin aineistosta. Juuritason design-system/ sisältää nyt vain yhteiset tokenit, visuaaliset käyttökortit ja komponenttireferenssit. Vedokset, staattinen keskusteluprototyyppi ja toimituksen toimeksiantokopiot ovat issues/receive-designer-v1/design/-hakemistossa. Design systemin AGENTS.md viittaa arkkitehtuuridokumentteihin ja styles.css:ään eikä enää kopioi tuotteen kuvausta, tokeniarvoja tai näkymäkohtaisia sisältösääntöjä.

### 2026-09-21T10:37:10Z · @pi

Jari hyväksyi 2026-09-21 workspace- ja agenttinavigoinnin yleisen suunnan ensimmäiseen funktionaaliseen MVP-versioon. Yksi palvelin riittää nyt. Workspacejen luonti ja poisto, GitHub-kytkentä, workspace-asetukset, worktree-toiminnot, arkisto ja vedoksen automaattiset sivuvaikutukset ovat tarkoituksellisia MVP-toimintoja. Agenttilistan tilailmaisun visuaalinen parannus siirtyy ensimmäisen toimivan version jälkeiseen katselmointiin. Yhteinen katselmointi keskittyy nyt keskustelupolkuun ja taustakykyjen todentamiseen, ei näiden host-toimintojen uudelleenrajaamiseen ilman teknistä estettä.

## Decisions

### 2026-09-22T16:09:58Z · @jari

Hyväksytty 2026-09-22 valmistelurevisiosta 6bcabaa451e4b0927548c408622dee5a0e44fe36. Kohdat 1 ja 3–8 hyväksyttiin valmistelijan suosituksen mukaisesti. Kohta 2 muutettiin: keskustelun otsikko generoidaan LLM:llä varmennetulla Pi:n agenttiloopin ulkopuolisella kertakutsulla ja voidaan generoida uudelleen muutaman viestin jälkeen aiheen tarkennuttua; viimeisin onnistunut otsikko säilyy korvattavana esitystietona ja epäonnistuminen ei estä keskustelua. Päätös, rajat ja myöhemmin todennettavat adapterivaatimukset ovat tiedostossa issues/review-ui-v1/review.md.
