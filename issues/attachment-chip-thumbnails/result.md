# Attachment chip investigation and regression coverage

The composer uploads each picked, pasted or dropped File before adding its
reference to the draft (`Composer.addFiles` → `uploadAttachment`). It creates no
local object URL or image bitmap. `AttachmentChips` then used the original
attachment URL as an image source, downloading and decoding the full file a
second time. The same component serves draft, queued and sent/history chips.

The parallel `offer-thumbnails-full-size` implementation owns the shared host
thumbnail route and `ImageThumbnail` rendering, including AttachmentChips.
This issue adds regression coverage at that consumer: fallback must not request
the original, changed resources get a fresh attempt, queued images use thumbnail
URLs, and a browser journey checks five large attachments before/after send and
reload, allowing original bytes only after explicit opening.

## Decisions for later review

- Reuse the host thumbnail for drafts too, rather than introduce local bitmap
  generation or a second preview cache. Draft chips already refer to uploaded
  resources, so a local decoding path would add work and lifetime management
  without removing an existing local decode.
- Keep the existing 20 MiB per-file upload limit. Five 26 MiB files cannot be
  attached today; the regression uses five 19 MiB synthetic PNGs (95 MiB total)
  within the existing per-file and per-message limits. Raising upload limits
  is not part of a thumbnail fix. The padded PNGs establish encoded transfer
  avoidance, not peak memory behavior for five photographic images.

## Validation

Pending integration with the shared route. Initial focused web runs found and
corrected a load-error lint suppression, a test matcher type mismatch, and the
queued-image test's old full-URL expectation. No daemon, contract or session
state changes are owned by this issue; review is focused self-review.
