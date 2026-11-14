---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/zip-download-no-progress
lane: unlaned
lane_seq: 1
preparation: ready
---

# Folder zip download shows no progress and starts late

## Description

Jari 9.11.2026 (test server, Brave): downloading a folder offer as a zip
(10 × 17 MB PNG, 162 MB) from the card's corner started, but the browser got
no bytes for a long time; it finished eventually, as if the bytes arrived
late or in one burst. The same route worked for a small folder. With no size
known, no progress shows and the download looks stuck.

Code: the link is a plain `<a download>` (`web/src/app/fileOffers.ts`
`zipURL`); the daemon streams the zip without Content-Length
(`internal/daemon/fileoffers_linux.go` `serveOfferZip`), relayed by the
gateway (`internal/gateway/fileoffers_linux.go` `fileRelay`, mode `zip`).

Expected: bytes start flowing at once and the browser shows progress. The
zip is uncompressed (`zip.Store`) and the file sizes are in the manifest, so
the exact size can be computed up front: send Content-Length, and find
whether any layer (gateway, the reverse proxy, the CDN) buffers the response.
