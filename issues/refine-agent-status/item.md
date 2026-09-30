---
created: 2026-09-21
updated: 2026-09-30
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 60
collision: [docs/, design-system/]
---

# Refine agent status visibility

## Goal

Revisit the agent-list status treatment after the first functional desktop version is in use.

## Context

Jari accepted the initial compact status-dot treatment for the first functional MVP and scheduled this as post-MVP design work. Begin by designing and reviewing the status treatment against observed use; do not treat the earlier whole-row suggestion as an implementation decision.

## Scope

This is post-v1 visual refinement. Preserve text or another non-color signal so status is never communicated only by color or hover.

## Acceptance Criteria

- [ ] Produce and review a concrete visual/interaction design before any implementation issue is activated.
- [ ] Evaluate the treatment against observed multi-agent use in the first functional version.
- [ ] Compare whole-row, label and other compact treatments in light and dark themes.
- [ ] Verify contrast, keyboard focus, reduced motion and non-color status communication.
- [ ] Record the selected treatment or close the issue if the existing presentation proves sufficient.

## Decisions

### 2026-09-30T17:54:12Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue käytiin läpi rethink-instructions-skillillä (gpt-6-astra) ja faktantarkistettiin fact-check-instructions-skillillä (claude-opus-5-5). Teksti on jo selkeä ja riittävän tiivis, joten sitä ei muutettu. Ilman Jaria säilytettiin Jarin kirjaama post-MVP-suunnittelun rajaus, alkuperäinen statuspisteen hyväksyntä ja designin katselmointi ennen toteutusta; navigaatio-shellin synteettisiä kuvia ei tulkittu aidoksi moniagenttikäytön havainnoksi. Faktantarkistus ei löytänyt korjattavia väitteitä. @review-mvp suljettiin vanhentuneena, mutta issue vaatii edelleen havainnot todellisesta käytöstä; estettä, kaistaa ja Jarin päätöksiä ei muutettu. Ei ristiriitaa Jarin aiempien päätösten kanssa.
