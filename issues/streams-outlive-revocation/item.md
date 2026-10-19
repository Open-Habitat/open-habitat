---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: open
priority: high
provenance: other
provenance_detail: found during research run 01m59mmt4k00emrtfsybwzfkw3
source_ref: taskfleet:01m59mmt4k00emrtfsybwzfkw3/finding:streams-outlive-revocation
originating_run: 01m59mmt4k00emrtfsybwzfkw3
originating_run_kind: research
lane: gateway-security
lane_seq: 1
collision: [internal/gateway/]
preparation: ready
---

# Event streams outlive logout and session revocation

## Description

An open event stream keeps delivering a person's conversation events to a browser after that browser session has been signed out or revoked by an administrator.

Observed by reading the code (2026-10-19, research `research-shell-editor`):

- The gateway checks the session once when a request starts (`authenticated` in `internal/gateway/session.go`); `proxy` in `internal/gateway/proxy_linux.go` then copies a stream until the daemon or browser ends it. Nothing in `revoke.go`, `logout` or session expiry cancels a request already in flight.
- The daemon's event stream writes `: heartbeat` every 20 seconds (`internal/daemon/events_linux.go`), which also keeps the gateway's 60-second idle read deadline from ever firing, so the stream lasts indefinitely.

Effect: revoking a stolen session (or signing out on a lost device) does not stop that client from reading the person's live conversation content, tool output and status for as long as it keeps the stream open. A planned browser shell (WebSocket through the gateway) would make the same gap a live write channel, so the fix is a per-session registry of streaming/upgraded requests that logout, revocation and expiry cancel.

Not reproduced live; a gateway test that opens a stream, revokes the session and asserts the stream closes would prove both the defect and the fix.
