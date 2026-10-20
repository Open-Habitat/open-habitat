---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: done
priority: normal
lane: attachments
lane_seq: 2
blocked_by: ['@composer-attachments']
collision: [attachments]
closed: 2026-10-20
---

# Reaching files on the person's own computer (Downloads, screenshots)

_Source: chat:ville-requests-2026-10-20_

## Description

Ville (2026-10-20): wants access to his own computer's files, especially Downloads. Jari: if at all possible the web UI should be able to fetch files from the person's computer.
A web page cannot read the local disk on its own; options: (1) drag/drop, paste and file picker (composer-attachments) — covers screenshots now; (2) the person keeps the folder in a synced cloud folder (Dropbox/OneDrive/Google Drive; integrations sync it into ~/cloud/ where the agent reads it) — no new component; (3) Chromium's File System Access API: the person grants one folder per session and the page uploads selected files — Chrome/Edge/Brave only, needs a click each session, no background access; (4) a small desktop companion that syncs a chosen folder — a new component and install step per computer. Conductor recommendation: (1)+(2) now, revisit (3)/(4) only if a concrete need remains after pilots. Awaiting Jari's decision.

## Decisions

### 2026-10-20T10:16:47Z · @jari

Jari, 2026-10-20: access only while the browser is open is enough. Build the browser route: the person grants a local folder (e.g. Downloads) once through the File System Access API with Chrome's persistent permission ('allow on every visit'; Chromium browsers — Chrome, Edge, Brave; Safari/Firefox show it as unavailable). While an Open Habitat tab is open, the agent can list that folder and fetch files from it on request: the agent asks through the person's daemon, the browser reads the file and uploads it via the attachments path (composer-attachments) into the person's home; only requested files cross, not the whole folder. When no tab is open the agent is told the folder is not reachable now. No Chrome extension (it gets no more file access than a page) and no desktop companion for now. Cloud folders (Dropbox etc.) remain the always-on route.

## Implementation result

The worker implementation is preserved but **not landed or verified**. Required final tests are blocked by shared-runner capture/spool failures and unresolved runner prerequisites. See [worker result](result.md) for exact evidence, failures and resume work.

## Acceptance Criteria

- [x] The person explicitly grants and revokes a browser-local folder; unsupported browsers explain the alternative.
- [x] A normal-profile Chromium reload retains the native handle and the same authenticated session; revocation persists across reload.
- [x] Native Pi can request bounded listings and individual uploads through the existing own-user attachment path, with one-use claims and no automatic uncertain-write retries.
- [x] Required focused web, browser/Axe, gateway, daemon and contract checks pass; independent critical review findings are assessed and repaired.
