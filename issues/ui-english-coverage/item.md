---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: done
priority: high
lane: i18n
lane_seq: 2
blocked_by: [ui-language-choice, '@en-conversation', '@en-composer', '@en-workspaces', '@en-workers', '@en-shell-editor']
preparation: ready
closed: 2026-10-31
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

Split 31.10. into five parallel units (`en-conversation`, `en-composer`,
`en-workspaces`, `en-workers`, `en-shell-editor`). This issue is the finisher
once they land: daemon/gateway texts that reach the screen as Finnish (the
units list what they met), the Finnish-string scan in the gate, and the
English screenshot set for Jari.

## Acceptance Criteria

- [x] With English chosen, no Finnish text in any view reachable on the test
      server (a scan for Finnish strings outside the Finnish catalog passes
      and is part of the gate).
- [x] Storybook stories render in both languages.
- [x] Screenshots of the main views in English for Jari.

## Comments
