---
created: 2026-11-09
updated: 2026-11-09
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: found by prototype worker reading the upload path
source_ref: taskfleet:01m6zm3zxt2hkcjcr7tyqazf62/finding:attachment-upload-timeouts
originating_run: 01m6zm3zxt2hkcjcr7tyqazf62
originating_run_kind: spinoff
---

# Slow attachment uploads hit the gateway's 60 s ceiling and the daemon's 5 s read timeout

## Description

Found while preparing `proto-attachment-upload-progress` (read from code, not measured on a live host).

An attachment upload streams from the browser through the gateway to the per-user daemon, and two time limits on that path cut a slow upload short:

- The gateway gives every finite proxied request a 60 s ceiling (`internal/gateway/proxy_linux.go`, `ceiling := 60 * time.Second`; `/api/v1/attachments` gets no exception). A 20 MiB file needs at least about 2.8 Mbit/s of upstream bandwidth to finish in time. On a mobile uplink of 1–2 Mbit/s it fails with 503 `daemon_unavailable`, which the browser reads as an uncertain save ("Liitteen tallennusta ei voitu vahvistaa…").
- The daemon's HTTP server on the user socket has `ReadTimeout: 5s` (`internal/transport/transport_linux.go`, `deadline = 5 * time.Second`, used by `ServeMux`, which also serves `/api/v1/attachments`). Go's ReadTimeout covers the whole body. The gateway passes the browser's body through as it arrives (`http.MaxBytesReader` streamed into the daemon request), so a body that takes over about 5 s to reach the gateway makes the daemon's `io.ReadAll` fail, and the daemon answers 400 `invalid_request`.

A front edge that buffers whole request bodies before forwarding them (such as Cloudflare's proxy) hides both limits, which may be why pilot uploads have succeeded. An installation without such an edge, or a slow uplink behind it, would hit them.

Expected: an attachment within the 20 MiB limit is saved on any working connection, or the limit is a stated product choice with its own wording. A possible fix is a per-route read deadline for the attachment upload in the daemon (via `http.NewResponseController(w).SetReadDeadline`) and a longer gateway ceiling for that route. To verify, upload a 20 MiB file through a throttled direct connection (no buffering edge).
