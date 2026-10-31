---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: open
priority: high
lane: i18n
lane_seq: 2
blocked_by:
  - ui-language-choice
preparation: ready
---

# English translation of the whole browser UI

## Description

After `ui-language-choice` lands with its catalog mechanism and the first
translated areas, move every remaining user-visible Finnish string in
`web/src` into the catalogs and translate it, so that an English-speaking
customer meets no Finnish. Includes messages the daemon or gateway produce
for the person (error texts, notices) where they reach the screen as text
rather than as a code the browser translates; prefer returning codes and
translating in the browser.

The work divides naturally by view (conversation, workspaces, editor and
shell chrome, integrations, storage and trash, administration), so it can
run as parallel units once the mechanism exists; units share the catalog
files, so the split must keep each unit's keys in its own catalog module.

## Acceptance Criteria

- [ ] With English chosen, no Finnish text in any view reachable on the test
      server (a scan for Finnish strings outside the Finnish catalog passes
      and is part of the gate).
- [ ] Storybook stories render in both languages.
- [ ] Screenshots of the main views in English for Jari.

## Comments
