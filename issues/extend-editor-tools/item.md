---
created: 2026-09-20
updated: 2026-10-05
type: task
status: open
priority: normal
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 30
collision: [docs/, design-system/]
preparation: pending
---

# Evaluate command completion and editor shortcuts after v1

This is accepted follow-up design work covering L6 and L12 in [the complete TUI follow-up list](../native-agent-host-architecture/ui-design-later.md). The aim is to identify which command and editor improvements would help people using the browser, based on observed use of the working product. Acceptance of this design work does not commit us to implementing every candidate.

Begin with native command discovery and midline slash completion if useful. Double-Escape and alternate copying modes remain browser-specific candidates, not mandatory TUI ports.

## Design approach

Ground command discovery in what the harness actually exposes, such as command names, descriptions and source labels, and verify which commands can be executed from the browser. A command available in the TUI may not be executable from the browser. The design should distinguish finding or inserting a command from running it, and show how completion inserts text at the cursor, including mid-sentence.

Normal browser selection, IME input, editor undo and browser shortcuts are the baseline to preserve. Consider keyboard and mobile interaction when evaluating completion. Quick clear or smart/default copying modes need an observed benefit beyond ordinary selection, deletion and copying. If double-Escape is worth pursuing, account for focus, open popups, agent activity, recoverability and the browser's own Escape behavior.

The [conversation v1 brief](../native-agent-host-architecture/ui-design-conversation.md) describes the editor and copying baseline. The [design package](../native-agent-host-architecture/ui-design-package.md) distinguishes delivered proposals from accepted requirements; double-Escape was not accepted as a v1 requirement.

## Boundaries and result

The agreed architecture (`docs/architecture.md`) keeps histories, component configuration and subprocess ownership with their native components and uses HTTP commands and SSE updates. This work does not introduce a workspace registry, parallel history store, credential broker, internal tenant model or speculative cache.

The result is a concrete command/editor interaction design grounded in observed needs and verified native capabilities, with a recommendation about which candidates are worth pursuing or leaving aside. The design is reviewed before implementation begins or any implementation issue is activated. Detailed plans, evidence and results belong in this issue directory.

## Decisions

### 2026-09-30T17:40:52Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra), faktantarkistus fact-check-instructions (claude-opus-5-5). Valitsin ilman Jaria toteuttajalle suunnatun ohjeen käsittelyn, tulkitsin hyväksynnän suunnittelutyöksi enkä kaikkien ehdokkaiden toteutusluvaksi, säilytin suunnittelun katselmoinnin ennen toteutusta ja jätin aikataulun metatiedot ennalleen. Faktantarkistus korjasi vanhentuneen MVP-porttiin viittaavan sanamuodon (Jari luopui portista 28.9.) sekä täsmensi, ettei harnessin komentolistassa ole suoritettavuuskenttää: selaimesta suoritettavuus pitää selvittää erikseen. Ristiriitoja Jarin kirjattuihin päätöksiin ei löytynyt.
