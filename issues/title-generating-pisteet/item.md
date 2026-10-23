---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: done
priority: normal
related: ['@proto-title-generating-animation']
preparation: ready
lane: unlaned
closed: 2026-10-23
---

# Header title: Pisteet animation while a title is generated

## Description

Jari 2026-10-23 chose direction **Pisteet** of `proto-title-generating-animation` (https://glasspad.example.test/p/mqp4jiyirvqpczpen7bmej722a/, round `design-system/prototypes/rounds/2026-10-23-otsikon-odotus/`). Implement it in production: while a conversation title is being generated or regenerated, the header title shows the Pisteet animation exactly as in the round (timing thresholds, first title vs. regenerated title, long name, failure state), light/dark, desktop/390 px, and reduced motion stops the animation.

## Acceptance Criteria

- [x] Pisteet in the production header through shared components/tokens; behaviour per the round; reduced motion respected; tests for state transitions (generating → title, generating → error); screenshots light/dark desktop/390 px.
