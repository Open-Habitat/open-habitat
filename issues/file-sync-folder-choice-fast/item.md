---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: integrations
lane_seq: 3
collision: [internal/daemon/integrations]
closed: 2026-10-22
---

# File integrations: folder choice must appear in seconds; inventory after the choice

## Description

Jari 2026-10-22 17:40 on 1362b57f, after `dropbox-sync-background-progress`: after pasting the code, "Viimeistellään kirjautumista ja luetaan tiedostoluetteloa. Odotetaan enintään minuutti…" spins so long that it feels broken, before the folder choice appears. The background copy itself then started well.

The folder choice must appear within a few seconds: list only what the choice needs (top-level folders, non-recursive), and move the full recursive inventory/size and quota admission out of the sign-in step — run it after the choice, in the background with the same progress display, refusing clearly if the selection exceeds quota. If any wait remains, show what is happening and how far it is.

## Acceptance Criteria

- [x] Folder choice appears within a few seconds after the code is accepted, also for a large Dropbox (synthetic fixture with many files).
- [x] Inventory/quota check runs after the choice in the background with progress and a clear refusal when over quota. Same for Google Drive and OneDrive if they share the path.
