---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [internal/daemon/integrations]
---

# Initial cloud sync interrupted by a daemon restart never resumes

## Description

Observed 2026-10-24 on the test server (`dropbox-status-unknown`): Jari's first Dropbox bisync started 2026-10-23 04:20 UTC was killed eight minutes later by a release restart of `open-habitat-daemon@maintainer`. It never resumed; the work dir kept only `*.lst-new` files and a stale lock. The landed fix names the state ("Ensimmäinen synkronointi jäi kesken") and sends the person to *Kirjaudu uudelleen*. But daemon restarts are routine (every release, reboots), and asking the person to sign in again for something the host interrupted is wrong.

Goal: an interrupted initial sync (Dropbox, Google Drive, OneDrive — whichever use rclone bisync's first pass) resumes on its own after the daemon starts, safely: clear only our own stale lock after proving no rclone process holds it, restart the initial pass with the person's previously chosen direction, and never overwrite either side differently than the person chose. The card shows progress again; "jäi kesken" only remains when the resume itself fails, with a concrete reason.

## Acceptance Criteria

- [ ] Restart during the first pass → after daemon start, the pass resumes and completes (integration test with a fake remote or a local rclone backend).
- [ ] A live lock held by a running rclone is never removed (test).
- [ ] KOKEILTAVAA.md line.
