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
URLs, and a browser journey checks five large draft attachments before/after
reload, allowing original bytes only after explicit opening. The existing
picker/paste/drop journey checks sent/history thumbnail URLs with small PNGs.

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

Integrated shared implementation `dea7fed7c` from main; the duplicate queued
image expectation dropped naturally on rebase. Focused self-review checked
that only thumbnail GETs occur before explicit opening and that fallback and
resource replacement do not retain a failed image. No daemon, contract or
session state changes are owned by this issue.

- `./scripts/test-focused.sh --area web`: 190 files / 1430 tests pass,
  plus lint, types and catalog checks.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts`:
  all four cases pass (8.2 s). Five 19 MiB uploads render at <=320 px with
  each thumbnail <100 KiB; no original GET until explicit opening. Draft
  reload, 404 fallback, 26 MiB upload refusal, sent/history thumbnail URLs,
  picker/paste/drop, narrow layouts and existing axe checks pass.
- `./scripts/test-focused.sh --area browser --spec attachment-documents.spec.ts`:
  both cases pass (8.9 s).
- Browser runs used private disk-backed TMPDIR, umask 077,
  `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=16370`, synthetic host and fake Pi.
- `web/lab/attachment-chip-thumbnails.mjs`: synthetic lab captures at 2x,
  paired PNG/HTML under `evidence/{draft-chips,sent-chips}`. Inspected the draft
  screenshot: all five thumbnails appear in compact wrapping chips.

Limits: these checks do not establish real-provider or separate-UID behavior,
peak browser heap, or photographic decode throughput. The fake Pi RPC scanner
accepts at most 1 MiB, so sending the 95 MiB padded-image batch killed that
fixture; large-image coverage stays at draft/reload, while small-image coverage
exercises actual sent/history rendering. No production upload cap was changed.

Initial checks exposed test-development errors, all corrected: lint and matcher
typing, obsolete queued URL expectations, snapshot use against a non-lab host,
reloading an optimistic send before its receipt, the fake-Pi scanner ceiling,
and an ambiguous icon locator. Lab capture retries corrected the workspace
fixture name and waited for the new conversation route before uploading.
A repeated `--spec` argument selected only the last spec; both specs were then
run separately. A KOKEILTAVAA insertion conflict retained both workers' lines.
