---
created: 2026-11-21
updated: 2026-11-21
type: feature
reporter: jari
status: done
priority: normal
related: ['@agent-account-instructions-clarity']
lane: account-permission
lane_seq: 1
preparation: ready
closed: 2026-11-21
---

# Permission question as a typed field in place of the composer

## Goal

When a tool call needs the person's permission (first user: the Microsoft account actions in `agent-account-instructions-clarity` — deletions and calendar sharing), Habitat asks with the **2 Kenttä** design from the prototype round `design-system/prototypes/rounds/2026-11-21-account-action-permission/`: the question takes the composer's place (bottom sheet with full-width buttons on a phone) until the person answers Salli or Älä salli, the stream shows *Agentti odottaa lupaasi · <action>*, which becomes the decision line, and the header shows the waiting mark. Icon: Kilpi ja kysymys.

The question is typed: action in plain words, the account, the consequence, and the technical call (area, tool, arguments) as separate fields in the browser–host contract, not a free-text confirm prompt (see `result-permission.md`).

## Decisions

- Jari 21.11.2026 chose direction 2 Kenttä because it forces the person to answer.
