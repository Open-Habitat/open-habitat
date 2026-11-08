---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Composer attachment chips render thumbnails from the full image

## Description

Jari 8.11.2026: the thumbnails on the composer's attachment chips (files
dropped, pasted or picked) have the same problem as offer cards
(`offer-thumbnails-full-size`): each chip draws the whole image (tens of MiB)
and is slow. Find whether the chip uses the local `File` (object URL of the
full image) or fetches the uploaded attachment back from the host, and make
the chip use a small thumbnail: for a local file, decode once to a small
bitmap in the browser (`createImageBitmap` with resize options or an
offscreen canvas, off the main thread where possible) and release the full
image; for an uploaded attachment shown later (history, reload), use the
host's thumbnail route that `offer-thumbnails-full-size` adds (rebase onto it
if it has landed; otherwise leave that path for it and note it). Oversized or
undecodable images show the file icon. Check message history attachment
previews too.

## Acceptance Criteria

- [x] Five large images use bounded thumbnails, never original-image downloads for chips. Verified with five 19 MiB files; 26 MiB files exceed the existing 20 MiB upload cap and are refused. Peak heap was not measured (see `result.md`).
- [x] Touched web and attachment browser specs green; `KOKEILTAVAA.md` line.
