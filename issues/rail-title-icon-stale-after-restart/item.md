---
created: 2026-11-16
updated: 2026-11-17
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-11-16/rail-title-icon-stale-after-restart
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-17
closed_by: claude
---

# After the host restart, a new conversation keeps the title 'Uusi keskustelu' and a wrong icon in the browser although it has been written in

## Description

Jari 16.11.2026 on the staging installation (v0.1.3), after the host rebooted at 15:16 local: a conversation he started and wrote in kept the rail title 'Uusi keskustelu' and showed the wrong icon; the view 'does not update properly'. At the same time the daemon's own list (open-habitat agent conversation list) already had a generated title for every live conversation (none named 'Uusi keskustelu'); the newest, created 13:22Z, was titled. So the browser's view appears stale: the live update of title/icon (and possibly other rail facts) did not reach the browser, or the browser kept a cache from before the restart. Investigate the daemon restart / reconnect path: does the browser resubscribe and refetch metadata (titles, workspace icons) after the daemon restarts; are title-generated events only pushed live and never refetched; was automatic title generation itself delayed after the restart.

## Resolution

### 2026-11-17T06:33:27Z · @claude

Fixed: silent event streams are reopened after missed heartbeats; a new daemon instance discharges old invalidations; a continued conversation owes the title its restart lost. See result.md.
