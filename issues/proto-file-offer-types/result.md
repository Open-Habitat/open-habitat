# Result: prototype round 2, file types

Prototype: `prototypes/file-offer-types/index.html` is one offline file
with three directions behind the picker.
[NOTES.md](prototypes/file-offer-types/NOTES.md) is Jari's guide in
Finnish, and `prototypes/file-offer-types/evidence/` holds the screenshots
at device scale factor 2. The round's source is
`design-system/prototypes/rounds/2026-10-27-tiedostotyypit/`. Its
`verify.mjs` rebuilds the page into this issue and checks 12
direction × width × theme cases, each with 13 file kinds. It checks that
previews open for every previewable kind and return focus. It checks
real playback, because the video and the synthesized audio advance. It
checks the in-card pager, the Markdown fold, the zip tree and audio
scrubbing, and that the unknown kind offers only Lataa. It also checks
for horizontal overflow, console errors and network requests, and finds
none. `make-media.sh` regenerates the embedded WebM and GIF.

## Axis and directions

The card is round 1's Kortti in every direction: label, file name, a facts
line ("Video (MP4) · 0:05 · 1920 × 1080 · 2,4 Mt · Vain sinulle"), Lataa
and one secondary action. Images show in the card in all three, as chosen
in round 1. The axis is **how much of the file the card itself shows**.

1. **Tunniste**: the card shows only the type and its facts. A kind icon
   in a kind colour (media, document, data/code) replaces the generic
   mark. The secondary action names what the person gets, such as Toista,
   Kuuntele, Lue, Selaa dioja, Näytä taulukko or Näytä sisältö.
   Everything opens in the preview dialog.
2. **Kurkistus**: the card shows a still, bounded peek of at most about
   200 px, and clicking it opens the preview:
   - video: a poster frame with a play mark and the duration;
   - audio: a waveform and the duration;
   - Markdown and code: the first lines, faded;
   - PDF and docx: the first page; pptx: the first slide;
   - CSV: the header and 4 rows with the remaining row count;
   - zip: the top-level folders with file counts;
   - GIF: the first frame with a GIF ▶ mark.
3. **Soitin**: the card is the viewer:
   - video: native controls in the card;
   - audio: a player with a scrubbable waveform;
   - Markdown: the whole text behind a fold;
   - PDF, docx and pptx: a ‹ › pager;
   - CSV: a scrollable 40-row table;
   - code: scrollable and highlighted;
   - zip: an expandable folder tree.

   Näytä isona opens the same preview.

The thread length for the same conversation is 1 : 1.5 : 1.9 (desktop).
The unknown kind (`.parquet`) is the same everywhere: facts, one sentence
saying the browser cannot show it, and Lataa only. The preview dialog is
shared. It is round 1's AttachmentPreview extended with video, audio,
Markdown, CSV (first 60 rows), code and a zip listing. Files inside a zip
cannot be opened.

## Host facts each direction needs

| Fact | Exists? | Needed by |
| --- | --- | --- |
| A kind for each file (image, svg, gif, video, audio, md, docx, xlsx, pptx, pdf, csv, code, zip, unknown) from name plus magic bytes, recorded in the offer manifest at freeze time | Partly. The daemon sniffs with `http.DetectContentType` (`attachmentType`), and the browser's `previewKind` covers pdf, md, docx, xlsx and pptx. Video, audio, SVG, CSV, code and zip are not classified | all |
| Facts for the meta line, computed once when the offer is frozen: image dimensions (Go `image.DecodeConfig`), zip entry count and unpacked size (`archive/zip`, central directory only), CSV row and column count, line count for text | No; all of these are cheap with Go's standard library | all (the facts line is the whole of Tunniste) |
| Media duration and video resolution | No. The Go standard library has no MP4/WebM parser. Either the browser reads them with `preload="metadata"` (needs Range), or a small container parser is added. Do not use ffprobe | all (facts line); the browser route is enough |
| PDF page count, pptx slide count | No server side. The browser gets them from the bytes (pdf.js, the pptx reader in `DocumentPreview`). docx has no page count without layout, so the facts line would say only "Word-asiakirja" | all; optional in the meta line |
| Owner-only read route that serves an offered file inline with its real `Content-Type` and supports HTTP Range (`http.ServeContent`), plus the download variant with `Content-Disposition: attachment; filename*=…` | No. Attachments are written whole with `w.Write`, inline only for PNG/JPEG/GIF/WebP. Range is needed for video seeking in any direction | all (video), 2–3 (poster, partial reads) |
| SVG shown only through `<img>` (scripts do not run), and the route sends `Content-Security-Policy: sandbox` and `nosniff` so that opening it directly cannot run script on the app origin | Pattern exists for view exports (separate origin and sandbox CSP); attachments serve SVG only as a download today | all |
| A text head (first ~8 KiB by Range) for the Markdown, CSV and code peek | No (needs Range) | 2 |
| Whole-text read with a cap for in-card Markdown, CSV and code | `markdownLimit` (1 MiB) exists for Markdown preview; reuse for CSV and code | 3, and the preview in all |
| Zip listing (names, sizes, folders), read from the central directory and never extracted | No; `archive/zip` at freeze time into the manifest, capped (e.g. 500 entries) | 2–3 in the card, all in the preview |
| Poster frame for video | Browser: a paused `<video preload>` seeked to a time shows the frame (as the prototype does). Needs Range. No server transcoding | 2 |
| Waveform for audio | No. The browser can decode the whole file with `decodeAudioData` under the size cap; the alternative is a flat bar | 2–3 |
| First page or slide of PDF, docx and pptx in the card | The browser renderers exist (`DocumentPreview`) but need the whole file, so the card must load lazily when it scrolls into view and skip files above a cap | 2–3 |
| Lazy loading of peeks and players (IntersectionObserver), at most a few in flight | No; a browser-only concern | 2–3 |
| One media element plays at a time; scrolling a playing card away keeps it playing or pauses it (decision) | No | 3 (and audio in 2 if Jari takes the hybrid) |

All files are served by the daemon running as the person, from the frozen
copy in the person's own home. The gateway authorises the owner session as
for view exports. No direction needs a new authority, a thumbnail store or a
server-side media toolchain. Every peek is derived in the browser from bytes
that the owner-only route already serves.

## Recommendation

**Kurkistus, with audio playable in its card.** A conversation is read top
to bottom, and Kurkistus is the only direction where every card says what
the file *is* at a glance and the thread stays still. Nothing moves or
sounds until the person asks. Tunniste is cheaper, but the press release,
the brochure and the board deck become three alike rows told apart by
name, and the agent's work is the content. Soitin makes the thread about
twice as long and turns the conversation into a media browser with
playing elements that can scroll away.

Audio is the one kind where the peek does not do its job: a waveform that
looks like a player but opens a dialog is a false affordance, and a
dialog for sound alone adds nothing. So its peek should be Soitin's
player. Video stays a poster frame because a playing video in the thread
competes with the reply.

The host work is the same for Kurkistus as for Soitin and only slightly
more than for Tunniste:
- kind and facts in the manifest;
- one Range-capable inline route;
- the zip listing.

The rest is browser rendering that `AttachmentPreview` and `DocumentPreview`
already do, loaded lazily.

Questions for Jari (in NOTES.md):
- Should video or audio play in the card?
- Is the browser's own Office rendering good enough, given that
  LibreOffice on the server is not recommended?
- Should a GIF animate in the card or stay still?

## Library suggestion

None needed. The round overrides `markerR` locally, adds its own dialog to
`.frame`, and uses `md()` and `hlLines()` from the library. `.frame` is
also the stage frame's class, so a round must not use it for its own
elements (this round first did, and the verifier's screenshot locator
matched both).
