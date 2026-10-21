---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: in-progress
priority: normal
lane: skills
lane_seq: 1
related: ['@proto-skill-catalogue']
collision: [contracts/v1, web/conversation-empty-state]
preparation: ready
size: L
---

# Aloita tästä: repository-defined starting goals and skill catalogue

## Description

Implement Jari's choice from proto-skill-catalogue round 2 (direction 3, "Aloita tästä"; see issues/proto-skill-catalogue/result.md and its Decisions, and design-system/prototypes/rounds/ for the round-2 prototype source).

A new conversation's empty state shows the repository's starting goals plus a "Tutustu taitoihin" entry that opens a use-case skill catalogue (topics, "Uutta sinulle" since the person's explicitly acknowledged cutoff, "Repon yhteiset"/own global skills, detail card, "Kokeile luonnoksessa" inserting `/skill:<name>` and the example into the draft without sending).

Jari 2026-10-21: the content of "Aloita tästä" is defined in the repository itself. Starting goals are repository skills (`.pi/skills`, `.agents/skills`, from Pi's effective trusted skill set) that mark themselves as starting goals in their own frontmatter `metadata` (e.g. `open-habitat-start: <order>`), next to the proposed `open-habitat-title/topic/when/example` fields. No host-side store, registry or separate catalogue file. Skill author/time come from the Git commit that added the skill file (unknown when history cannot say). When the repository marks no starting goals, the empty state shows only "Tutustu taitoihin" and a short hint on how a team adds them.

Out of scope: AI-generated presentation proposals (AI-ehdotus) and writing them back to frontmatter; a later issue if Jari wants it. Fall back to the skill's own `description` where presentation metadata is missing.

Done: daemon reads the facts natively as the person (contract in contracts/v1, generated code regenerated), empty state and catalogue in production components with stories, phone and desktop, light/dark; record the decisions a later review needs in result.md "Decisions for later review"; add a KOKEILTAVAA.md entry.
