---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 10
blocked_by: ['@receive-designer-v1', '@finalize-design-docs']
commits:
- hash: c2c0be8ba0c62f56144ffaa8132cbc92d27e3332
  summary: 'docs(ui): accept the workspace MVP direction'
---

# Review and agree the designer UI v1

## Goal

Review the delivered UI against the bounded v1 brief and agree the implementation target with Jari.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Check B1–B10, B12 and B5a–B5f; B11 and L1–L13 must not become v1 requirements.
- [x] Check host A1–A6, A8 and basic A9; ensure navigation and conversation form one usable flow.
- [ ] Walk through sending, resume, read-only agents, grouped tools, diffs, copy, supported questions, interruption and uncertain sends/reconnect.
- [ ] Record requested corrections, their resolution and explicit user acceptance of the implementation target.
- [ ] Record chosen UI components and unresolved adapter requirements; a mock does not prove Pi integration.

## Comments

### 2026-09-20T08:34:12Z · @pi

Keskustelun v0.1-aineisto on vastaanotettu projektin juuren design-system/-hakemistoon ja alustava arvio tiedostoon ../receive-designer-v1/review.md. Katselmoinnissa päätettävät poikkeamat ovat erityisesti desktop-first ilman mobiilivedoksia, viestijono ja kesken vuoron ohjaus, automaattinen otsikointi sekä komponenttien saavutettavuus ennen tuotantokäyttöä. Paketin 1 päivitetty toimeksianto ja v2-zip käyttävät visuaalista suuntaa, mutta eivät tee näistä avoimista ehdotuksista backend-vaatimuksia.

### 2026-09-20T08:38:03Z · @pi

Design system siirrettiin vastaanotto-issuen alta projektin pysyväksi juuritason hakemistoksi design-system/. Issueen jäi alkuperäinen zip, checksumit ja vastaanottoarvio. Käytä katselmoinnissa ja myöhemmässä UI-työssä juuritason design-system/ polkua.

### 2026-09-20T08:51:55Z · @pi

Jarin palautteen perusteella design system erotettiin ensimmäisen keskusteludesignin aineistosta. Juuritason design-system/ sisältää nyt vain yhteiset tokenit, visuaaliset käyttökortit ja komponenttireferenssit. Vedokset, staattinen keskusteluprototyyppi ja toimituksen toimeksiantokopiot ovat issues/receive-designer-v1/design/-hakemistossa. Design systemin AGENTS.md viittaa arkkitehtuuridokumentteihin ja styles.css:ään eikä enää kopioi tuotteen kuvausta, tokeniarvoja tai näkymäkohtaisia sisältösääntöjä.

### 2026-09-21T10:37:10Z · @pi

Jari hyväksyi 2026-09-21 workspace- ja agenttinavigoinnin yleisen suunnan ensimmäiseen funktionaaliseen MVP-versioon. Yksi palvelin riittää nyt. Workspacejen luonti ja poisto, GitHub-kytkentä, workspace-asetukset, worktree-toiminnot, arkisto ja vedoksen automaattiset sivuvaikutukset ovat tarkoituksellisia MVP-toimintoja. Agenttilistan tilailmaisun visuaalinen parannus siirtyy ensimmäisen toimivan version jälkeiseen katselmointiin. Yhteinen katselmointi keskittyy nyt keskustelupolkuun ja taustakykyjen todentamiseen, ei näiden host-toimintojen uudelleenrajaamiseen ilman teknistä estettä.
