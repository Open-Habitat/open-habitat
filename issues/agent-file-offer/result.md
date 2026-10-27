# Result: agent file offer

The agent hands files to the person with

    open-habitat agent file offer --current --source out/report.pdf --idempotency-key UUID --json

(repeat `--source`; one directory alone becomes a package; `agent file list`
and `agent file remove --offer-id` beside it). The daemon freezes a copy under
`~/.local/state/open-habitat/files/<id>/` with a manifest of each file's kind
and facts, and the conversation gets a notice carrying the offer. The
browser shows the Kortti/Tunniste card (one file) or Hylly's compact package
card, opens every previewable kind in the attachments' preview dialog, and
lists the conversation's offers in a file panel opened from the top bar
(full screen on a phone).

Screenshots at device scale factor 2 are in `evidence/`
(`tunniste-desktop-light.png`, `hylly-desktop-light.png`,
`hylly-desktop-dark.png`, `kortti-phone-light.png`, `hylly-phone-light.png`),
written by `web/tests/agent-file-offers.spec.ts` with `OH_VISUAL_CAPTURE=1`.

## Checks run

- `go test ./internal/daemon ./internal/gateway ./internal/cli
  ./internal/diagnostic ./test/browser-host` (umask 077): pass. New:
  `TestFileOfferFreezesOnlyWhatItNames`, `TestFileOfferReadsOnlyFilesOfThatOffer`
  (symlinks, fifo, traversal, `%2F`, another offer's file, untrusted peer,
  Range, zip contents, conversation-scoped list), `TestArchiveListingIsBounded`,
  `TestFileKindNeedsAgreeingBytes`, `TestFileOfferBytesArePresentedByTheGateway`
  (types, attachment names with RFC 8187 encoding, sandbox CSP, single-range
  only, no session no daemon request), `TestFileOfferArgumentsRefuseBeforeSocket`.
- `./scripts/test-focused.sh --area contracts` and `--area web`: pass.
- Browser (OH_BROWSER_WORKERS=2): `agent-file-offers.spec.ts` (5 cases: each
  kind's card, preview and named download; a directly opened SVG runs no
  script; package zip and the file panel with search, focus return and axe;
  removed offers inert, also when removed while the page is open; phone),
  `agent-views.spec.ts` and `attachment-documents.spec.ts`: pass.
- Independent review: `/llm-review` (gpt-6-astra finder, claude-fable-5-1
  verifier) found six real defects, all fixed: a zip's central directory read
  unbounded, multi-range relay mislabeled, CSV preview columns unbounded, the
  panel built on the 200-offer account-wide list, full manifests decoded for
  every list, removed offers not revalidated. No path escape, cross-user read,
  header injection or app-origin script execution was found.

Same-UID synthetic evidence only; the distinct-UID boundary is the existing
gateway/daemon mapping, unchanged.

## Decisions for later review

- **Served on the app origin, not a view host.** Downloads and previews go
  through `/api/v1/file-offers/...` on the app's own host, so no
  configuration is needed and a phone download is an ordinary link. The
  gateway, not the daemon, decides presentation: only images, audio and video
  are announced with their type, and only on the `inline` route the app's
  own elements read; everything else, and every `download`, is
  `application/octet-stream` with `Content-Disposition: attachment`, and
  every byte response carries `Content-Security-Policy: sandbox; default-src
  'none'…` and nosniff. Alternative: the view host's separate origin, which
  would need the optional view origin configured.
- **Frozen copy, own store.** `~/.local/state/open-habitat/files/`, beside
  views, removed only by `agent file remove`; it counts against the
  person's quota. Alternative: a reference to the workspace file, which would
  change under the card when the agent rewrites it.
- **Limits:** 200 files and 512 MiB per offer, at most 20 `--source` flags
  (views: 500 / 50 MiB). The photo package of the prototype (97 MB) fits.
- **Command shape:** `agent file offer|list|remove`, repeatable `--source`,
  `--title` required with several sources, `--offer-id` for removal
  (`--offer` was taken by `admin ai-key`).
- **Facts read at freeze time** with the Go standard library only: kind
  (extension checked against magic bytes for PDF, Office and zip),
  image size for PNG/JPEG/GIF, lines and CSV columns for text up to 16 MiB,
  a zip's entry count, unpacked size and up to 100 names (skipped for ZIP64
  or a directory over 1 MiB). Not done: media duration and resolution, PDF
  page and slide counts, WebP/AVIF size; the card's facts line omits them.
- **No server thumbnails.** The package card's strip and the panel's rows
  load images lazily from the inline route. The prototype round
  recommended 320 px thumbnails generated at freeze time for large photo
  packages on a phone; that would be a derived file in the offer and can be
  added if the strip proves slow.
- **Hylly without versions or a removed section.** The panel lists the
  conversation's current offers (a conversation-scoped list, newest first,
  grouped by folder) with search and the selected file's preview; it has no
  *Aiemmat versiot* link between re-offers of the same source and no
  *Poistetut* section. A removed offer stays in the thread as an inert card
  without the removal time (the copy is gone, nothing records when).
- **Preview:** video and audio play from the inline route with Range; CSV is
  a table of the first 60 rows and 50 columns, code and text are plain text
  up to 1 MiB, a zip is listed from its facts; documents are read whole up to
  50 MiB. Larger files are download only.
- **Zip of the whole offer** streamed with Store, named by the page from the
  folder or title; no per-folder zip.
- **Top-bar toggle** shows the conversation's file count and only when it has
  offers; on a phone it sits in the header's second row.
