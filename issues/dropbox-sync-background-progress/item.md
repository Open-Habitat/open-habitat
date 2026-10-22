---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: integrations
lane_seq: 1
collision: [internal/daemon/integrations]
closed: 2026-10-22
---

# Dropbox: bounded sign-in wait and background initial sync with progress

## Description

Jari 2026-10-22 ~15:28 on pilot.314: connecting Dropbox went quickly until the link-copy/paste step, then the dialog spun for a long time. The first sync takes very long and shows no progress at all.

Wanted (Jari):
- The sign-in step has a bounded wait (about 60 s) with a clear outcome, not an open-ended spinner.
- The initial sync runs in the background with a progress indicator (files/bytes or at least phase and elapsed), so the person can close the dialog and keep working; the integration shows its sync state and completion afterwards.

Note: the site outage Jari saw during the sync (15:28) was the pilot.315 release switch, not Dropbox. The daemon logged two `PUT /api/v1/integrations/login` at ~1.5 s each, so the long wait was after the login call — find where (initial sync/listing) from the code and a reproduction.

## Acceptance Criteria

- [x] Dropbox sign-in completes or fails within a bounded time with a clear message.
- [x] Initial sync runs in the background with visible progress and a final state; closing the dialog does not cancel it. Same pattern applies to the other file integrations (OneDrive, Google Drive) if they share the code.
