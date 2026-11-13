---
created: 2026-09-20
updated: 2026-10-05
type: task
status: open
priority: normal
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 50
collision: [docs/, design-system/]
preparation: pending
---

# Design one improvement to tool views after v1

## Purpose

Use observed v1 use to select and design one improvement that makes agent
activity easier to understand: richer diffs, a renderer for an MCP, web or
subtask tool actually used, or a justified density or display-style option.

This is accepted design work after v1 covering L9–L11 in
the historical TUI follow-up list (`issues/native-agent-host-architecture/ui-design-later.md`, in the project's history, not in this repository).
Those entries are candidates, not a commitment to implement the whole list.

The linked [review issue](../review-mvp/item.md) records Jari's decision on
2026-09-28:

> Jari no longer wants a fixed MVP completion boundary or a final whole-system acceptance gate. Continue the product through observation-by-observation review and corrections, including specific UI and safety checks in their own issues; do not treat closure as acceptance of unfinished functionality.

## Design basis

Choose the improvement from a concrete difficulty observed in use. Ground the
visual and interaction design in real diff/event data and the information the
native component actually supplies. The
historical design package (`issues/native-agent-host-architecture/ui-design-package.md`)
and conversation v1 brief (`issues/native-agent-host-architecture/ui-design-conversation.md`)
provided the earlier design context; their proposals do not establish current
adapter support. Both documents belong to the project's history, not this repository.
For current visual guidance, see [the conversation design](../../design-system/design.md#keskustelu).

Grouping should make activity easier to scan while keeping individual calls,
their order, errors and user requests visible or inspectable. Parent and
parallel relationships come from source evidence, not an inferred execution
plan. Missing or truncated content remains identifiable.

A diff describes changes; approval controls apply only to a genuinely pending,
supported request, not an already-applied edit. Specialized renderers and
density or display-style settings need an observed benefit rather than a speculative tool
taxonomy or a catalogue of visual options.

## Boundaries and result

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

The architecture (`docs/architecture.md`) explains these ownership boundaries:
a presentation improvement should not create another source of truth.

Keep detailed plans and results in this issue directory. Design review precedes
activation of an implementation issue; this issue does not itself authorize
implementation.

## Acceptance Criteria

- [ ] Review one concrete visual/interaction design based on an observed difficulty, real diff/event data, and a small draft tried in an actual agent conversation.
- [ ] Split the selected improvement into a bounded implementation issue before activating it.

## Decisions

### 2026-09-30T17:43:46Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra), sitten fact-check-instructions (claude-opus-5-5). Muotoilin toteuttajalle suunnatun tehtävän tavoitteen, aineiston, rajojen ja hyväksyttävän tuloksen ympärille. Ilman Jaria jätin L9–L11:n vaihtoehdoiksi, en valinnut ominaisuutta ilman käyttöhavaintoa; säilytin frontmatterin ja suunnittelukatselmuksen ennen toteutuksen aktivointia. Faktantarkistus vahvisti Jarin 28.9. päätöksen sanamuodon ja korjasi vanhentuneen teemanvalinnan: vaalea/tumma/järjestelmä on jo käytössä, jäljellä tiheys tai esitystapa. Korjasin myös post-MVP-termin muotoon v1:n jälkeen ja säilytin pienvedoksen kokeilun aidossa keskustelussa lähdeluettelon mukaisesti. Ei ristiriitaa Jarin aiemman päätöksen kanssa; poistettua koko MVP:n hyväksyntäporttia ei palautettu. Riippuvuutta vanhentuneeseen review-mvp-issueen ei muutettu, koska aikataulutuksen muuttaminen ei kuulu tähän yksikköön.
