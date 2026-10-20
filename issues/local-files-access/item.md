---
created: 2026-10-20
updated: 2026-10-20
type: task
reporter: jari
status: open
priority: normal
---

# Reaching files on the person's own computer (Downloads, screenshots)

_Source: chat:ville-requests-2026-10-20_

## Description

Ville (2026-10-20): wants access to his own computer's files, especially Downloads. Jari: if at all possible the web UI should be able to fetch files from the person's computer.
A web page cannot read the local disk on its own; options: (1) drag/drop, paste and file picker (composer-attachments) — covers screenshots now; (2) the person keeps the folder in a synced cloud folder (Dropbox/OneDrive/Google Drive; integrations sync it into ~/cloud/ where the agent reads it) — no new component; (3) Chromium's File System Access API: the person grants one folder per session and the page uploads selected files — Chrome/Edge/Brave only, needs a click each session, no background access; (4) a small desktop companion that syncs a chosen folder — a new component and install step per computer. Conductor recommendation: (1)+(2) now, revisit (3)/(4) only if a concrete need remains after pilots. Awaiting Jari's decision.
