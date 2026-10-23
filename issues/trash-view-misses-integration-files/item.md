---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: storage
lane_seq: 1
collision: [internal/daemon/trash]
closed: 2026-10-23
---

# Trash view is empty after an integration's files were moved to trash

## Description

Jari 2026-10-23 07:15 on the test server: removing the Microsoft integration offered to move its synced files to the trash; he chose to. Afterwards the trash view (Asetukset › Tallennustila / roskakori) said the trash is empty. The daemon did move them: `~/.local/share/Trash/files/maintainer@example.org` exists (04:15 UTC), so the files are kept but invisible in the product.

Find why the trash view does not show it: does the integration removal write a freedesktop Trash entry without `info/<name>.trashinfo`, or does the trash view read only workspace trash, or something else? One native trash (freedesktop Trash, which the agents and other tools also see) and one view of it. The view must list items trashed by integration removal and by workspace deletion, with restore and permanent delete, and the removal dialog should say where the files went.

## Acceptance Criteria

- [x] Items trashed by integration removal appear in the trash view and can be restored or deleted; regression test for both producers.
- [x] The existing trashed `maintainer@example.org` folder on the test server becomes visible after the fix (if it lacks a .trashinfo, the fix handles such legacy entries or Jari is told precisely).
