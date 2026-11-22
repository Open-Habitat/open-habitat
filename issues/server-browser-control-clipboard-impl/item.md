---
created: 2026-11-22
updated: 2026-11-22
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-control-clipboard-impl
lane: server-browser-control
lane_seq: 2
preparation: ready
closed: 2026-11-22
---

# Server browser: take control by clicking the canvas, clipboard both ways (Kehys)

## Description

Implement the accepted server-browser control and clipboard design
(`server-browser-control-clipboard`, Jari 22.11.2026): direction 1 Kehys from
round `design-system/prototypes/rounds/2026-11-22-browser-control-clipboard/`
is the specification; the issue's result.md carries the architecture sketch
and the decisions (security level accepted; idle takeover click delivered;
auto-return after 3 idle minutes without an open agent request).

## Resolution

### 2026-11-22T08:16:18Z · @issuectl

Implemented Kehys with click takeover, clipboard both ways and the accepted security level; real Xvnc/Chromium lab qualified paste/copy ordering and the give-back clear. Keystrokes are limited to the remote US layout (lab finding; canvas typing defect filed as server-browser-non-us-keys).
