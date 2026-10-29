---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: workspace-page
lane_seq: 1
collision: [web/src/components/HomeWorkspaces.tsx]
preparation: ready
---

# Workspace page: Esittely landing; a goal lands with Aloita done

_Source: chat_

## Description

Implement `proto-workspace-landing` direction **Esittely** (Jari 29.10.): the workspace page shows the repository's authored start page (`.agents/start-page.md`): title, first paragraph (rest behind *Näytä koko esittely*) and the same goal cards; absent start page offers *Luo aloitussivu*.

Jari's change: choosing a goal must not land on a page that still needs an Aloita press. Choosing a goal on the workspace page creates the new conversation with Aloita already done: the goal's request (and skill invocation) is in the composer, focused, ready to send. Only when the request has something to fill in (a `[placeholder]`) does the person fill it first, with the placeholder selected as today. The guide stays reachable from the conversation (e.g. the goal chip/panel), not as a mandatory stop. Decide whether the conversation start page's own goal cards should behave the same and record it.

## Acceptance Criteria

- [ ] Esittely section on the workspace page from the existing start-page read; desktop and phone.
- [ ] Goal → new conversation with the request in the composer, no extra Aloita step; placeholder selected when present.
- [ ] Browser specs; KOKEILTAVAA line.
