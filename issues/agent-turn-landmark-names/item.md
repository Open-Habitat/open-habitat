---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed by an agent in a browser test run
source_ref: taskfleet:01m5p7mfxwhnkr93xp6w85kw0h/observation:agent-turn-landmark-unique
originating_run: 01m5p7mfxwhnkr93xp6w85kw0h
originating_run_kind: spinoff
lane: conversation
lane_seq: 1
collision: [web/src/components/AgentTurn]
preparation: ready
---

# Conversation agent turns are duplicate 'Agentin vuoro' landmarks (axe landmark-unique)

## Description

## Observation

A conversation with two or more agent turns fails axe's `landmark-unique` rule (moderate): every agent turn renders as `<section data-testid="agent-turn" class="ah-agent-turn" aria-label="Agentin vuoro">`, so the page has several `region` landmarks with the same accessible name. Screen-reader landmark navigation lists them as indistinguishable entries.

Observed 2026-10-24 in a host-backed Playwright run (synthetic host, worker run 01m5p7mfxwhnkr93xp6w85kw0h): after two turns in one conversation ("Näytä tiedosto", then a second prompt), `new AxeBuilder({ page }).analyze()` over the whole page reported `landmark-unique` with target `li[data-kind="assistant"]:nth-child(4) > .ah-agent-turn[data-testid="agent-turn"][aria-label="Agentin vuoro"]`. Existing whole-page axe checks pass only because their journeys have a single agent turn.

## Possible directions

Give each turn a distinguishing name (for example its ordinal or time), or drop the region role from turns (a plain `<section>` without an accessible name is not a landmark) and rely on the list structure.
