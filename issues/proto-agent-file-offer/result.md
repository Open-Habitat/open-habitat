# Result: prototype round 1

Prototype: `prototypes/file-offer/index.html` is one offline file with
three directions behind the picker. [NOTES.md](prototypes/file-offer/NOTES.md)
is Jari's guide in Finnish, and `prototypes/file-offer/evidence/` holds the
screenshots (device scale factor 2). The source is the round directory
`design-system/prototypes/rounds/2026-10-26-agentin-tiedostot/`. Its
`verify.mjs` rebuilds the page into this issue and checks 12
direction × width × theme cases: previews, focus return, inert removed files,
the shelf panel, no overflow, no console errors and no network requests.

## Starting point today

- **HTML view offer** (`open-habitat agent view offer`, ADR 0032): the
  daemon freezes a copy of the named workspace files into
  `~/.local/state/open-habitat/views/<id>/` with a manifest (title, entry,
  files, bytes, source path, conversation). It emits `view.offered`, and the
  conversation shows `ViewOfferCard` ("Agentti tarjoaa näytettäväksi",
  Avaa / Avaa omalle välilehdelle, "Vain sinulle"). The gateway serves
  exports from the separate `oh-view-*` host under a sandbox CSP. Limits are
  500 files and 50 MiB. Offers without a conversation are being removed
  (Jari, KOKEILTAVAA 26.10.), so file offers should be conversation-bound
  from the start.
- **Attachments** (`internal/daemon/attachments_linux.go`): files in
  `~/attachments/<uuid>` with no metadata (no name, no conversation). Each
  file can be up to 20 MiB, and the quota is 1 GiB. Only PNG, JPEG, GIF
  and WebP are served `inline`. Everything else is served as
  `Content-Disposition: attachment` without a filename, with `nosniff` and
  `no-store`. The agent can already register bytes with
  `open-habitat agent attachment create`.
- **Agent text is Markdown through the same renderer as the person's**, and
  `MarkdownRenderer` turns `![name](/api/v1/attachments/<uuid>)` into a
  clickable image that opens `AttachmentPreview`. So an agent can put an
  image into its reply today, without new host work, if it knows the URL
  form. A non-image file has no such path: a link would download as
  `<uuid>` unless the browser's `download` attribute supplies the name.
- **`AttachmentPreview`** already renders images, PDF (pdf.js), Markdown,
  docx, xlsx (sheet tabs) and pptx from bytes, and it has a Lataa action.
  All three directions reuse it as is.

## Axis and directions

The axis is **where the agent's file lives in the conversation and how much
room it takes**. Content is identical in all three: a draft PDF that the
agent later removes, a three-file package (PNG chart, xlsx with three
sheets, 8-page PDF) and a single corrected PNG.

1. **Kortti**: a notice card after the reply, in the same pattern as the
   HTML view offer. It shows the label, title, "N tiedostoa · koko · Vain
   sinulle", the image previewed inside the card, and file rows (type, name,
   size, download). A package also gets *Lataa kaikki (.zip)*; a single
   file gets Lataa and Näytä isona / Esikatsele. A removed offer stays as an
   inert card: the title is struck through and the card says "Poistettu
   klo 13.31".
2. **Vastauksessa**: the files are part of the reply bubble. An image shows
   full width under the text with its name, size and download. Other files
   are chips like the person's own attachments, and a removed one is a
   dashed "poistettu" chip. There is no title and no zip.
3. **Hylly**: the thread has only a one-line marker ("Pi jakoi 3
   tiedostoa … Näytä"). A *Tiedostot (4)* button in the top bar opens a
   side panel (full screen on a phone). The panel shows a preview of the
   selected file, its facts, Lataa and Avaa isona, and below that every
   file in the conversation grouped by offer (newest first, .zip per
   package) and a *Poistetut* section.

## Host facts each direction needs

| Fact | Exists? | Needed by |
| --- | --- | --- |
| Agent command to offer workspace files to the current conversation (`agent file offer --current --source … [--title]`, idempotent) | No; `agent view offer` is the model to copy | all |
| Frozen copy, not a reference to the workspace file | View export freezing exists; a file offer can be a view-export kind | all (recommended: a reference would break when the agent rewrites `out/`) |
| Manifest per file: name, bytes, sniffed type, image dimensions / page count, offered-at, conversation | Views store name, bytes, conversation; no per-file type or dimensions | all; dimensions and pages only for the meta line (optional) |
| Download route with `Content-Disposition: attachment; filename*=UTF-8''<name>`, `nosniff`, `no-store`; images also inline for preview | No. View exports render sandboxed, attachments download without a name | all |
| Preview bytes to `AttachmentPreview` | Component exists; needs a read route for an offered file | all |
| Offer event and a conversation notice carrying the offer (`file.offered` beside `view.offered`) | Pattern exists for views | 1, 3 |
| Offer anchored inside the reply turn rather than after it | No: notices are their own entries; the alternative is the agent writing Markdown references | 2 |
| Removal (`agent file remove`) and a "removed at" fact the browser can show | `agent view remove` exists; a removed export currently just disappears | all |
| List of offers per conversation | `agent view list` is account-wide; would need a conversation filter | 3 |
| Server-built zip of one offer | No | 1, 3 (only if Jari wants *Lataa kaikki*) |
| Limits | Views: 500 files / 50 MiB; attachments: 20 MiB / 1 GiB | all; proposal: views' limits, a smaller file count (e.g. 20) |

Only the daemon running as the person serves the files, from the person's own
home. The gateway decides who may read (the owner's session only), exactly
as for view exports. No new authority is needed.

## Recommendation

**Kortti.** It reuses what the HTML view offer already settled: the frozen
copy, the conversation notice, the "Vain sinulle" promise and the owner-only
read route. So the host work is a second export kind with a download route
rather than a new mechanism. It is also the only direction that keeps every
state honest in place: several files, a removed file that still says what
it was, and a single image shown large without a second click. Vastauksessa
is lighter, but it has no place for a title, a zip or a clear removed state.
Its image half also already works today through attachments, so it can
remain the quick route for an inline chart. Hylly becomes worth it when
conversations routinely carry dozens of files. It can later be added on
top of Kortti as a list of the same offers.

Questions for Jari: whether a produced image shows directly in the
conversation, whether *Lataa kaikki (.zip)* is wanted, and whether the
person may remove an offered file or only the agent may (see NOTES.md).

## Library suggestion

None needed. The round only overrides `markerR` and `APP.actions` locally,
and adds its own panel to `.body`.
