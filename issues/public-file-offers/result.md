# Result

File, table, image, PDF and folder offers are made public exactly like views:
the corner globe publishes for the site's default length (30 days), the date
changes the duration, *Kopioi linkki* copies the stable address `/n/<entry>`,
the own tab opens at that address, and Settings › Tili › *Näkymien ja
tiedostojen osoitteet* lists offers with views (open, copy, make private,
delete for good). An anonymous reader opening a public offer's address is
redirected, as for views, to the address's own content host, where the gateway
writes a page of the offer: title, file list, images, video and audio shown, a
one-file table's or text's beginning, every file and the whole offer (zip)
downloadable. The page runs no script (`sandbox allow-downloads`), sets no
cookie, is `noindex`.

## How it stays as narrow as views

- The ADR 0035 reservation now names exactly one of `view_id` or `offer_id`
  (store, contract `oneOf`, validation). Ensure and publish confirm the offer
  through the owner's daemon, as for views.
- Every public read goes through the same `viewLinkServe` checks (token in
  constant time, publication, expiry, site switch, owner denial, store health),
  relay slots and daily byte budgets. Revocation/withdrawal/admin deletion
  already delete reservations by owner, so offers are covered.
- The gateway asks the daemon only with the reserved offer ID through the
  daemon's existing per-offer routes (`/api/v1/file-offers/<id>`,
  `/files/<path>`, `/zip`); the reader's path picks a file inside that offer,
  opened by the daemon beneath it without following links. The page never
  shows the offer's conversation or workspace. No daemon or provision change;
  gateway/daemon/provision authorities unchanged.
- Independent review (finder GPT-6 Astra, verifier Claude Fable 5.1) found two
  real gaps, both fixed with tests: the public zip was charged from the
  manifest's unchecked summary size (now Σ item sizes, and the relay stops past
  the charge), and the page write had no deadline while holding a relay slot.

## Tests

`go test -race ./internal/gateway` (new `offer_links_linux_test.go`: anonymous
read, traversal/other-offer/encoded-separator 404s, daemon asked only for the
reserved offer, escaping, Finnish page, expiry/private/republish/delete/removed
offer, budgets incl. zip bound, store round trip); contracts validate and
regenerate clean; web fast checks (193 files, 1451 tests, incl. new ViewHost
and ViewOpenPage cases); browser `view-links.spec.ts` (4, two new: public
offer and folder read by a cookie-less context with downloads, private/delete;
own tab at `/n/`) and `agent-file-offers.spec.ts` (6). Not covered: real
ingress, separate Unix users.

## Decisions for later review

- **No experimental flag.** Public views are gated only by the site's
  `views.link_max_days` (and a view origin); file offers follow the same gate,
  since this extends the existing control to more cards.
- **No new daemon route.** Round 2 suggested a fixed offer-read route like
  `/view-export/`; the existing per-offer routes already serve only one frozen
  offer and trust only the gateway peer, so a copy would add surface without
  narrowing anything.
- **Gateway-written page, not the raw file.** As round 2 decided; also for a
  single image (alternative: redirect straight to the file), so every kind
  looks alike and downloads stay one press away.
- **Preview only for a one-file table/text/code/markdown** (first 64 KiB, 20
  rows × 12 columns). Folder files are listed, not previewed, to bound daemon
  reads per page.
- **No thumbnails on the public page**: thumbnail generation is CPU work per
  anonymous request that the byte budget barely charges; images load full
  size, lazily, charged by bytes.
- **PDF and documents are downloads** on the public page (the sandbox blocks
  the browser's PDF viewer; pdf.js would need scripts).
- **Limits unchanged**: same per-address 2 GiB/day, site 20 GiB/day, relay
  slots, reservation and publication caps shared with views. A 512 MiB offer
  fits about four downloads a day per address.
- **A public read's relay lasts at most 30 minutes** (owner reads: 1 hour),
  since it holds one of few slots; each write is still bounded to 30 s.
- **CORP dropped for public offer bytes** (kept for the owner): the page's
  opaque sandbox origin makes every image request cross-origin.
- **Publish only for the whole offer**: inside a folder's file the panel shows
  the state but no globe; folder files have no own address (round 2).
- **Settings row renamed** *Näkymien ja tiedostojen osoitteet* / *View and file
  addresses* (round 2 suggested *Jaetut osoitteet*; this keeps the existing
  wording and matches the assets list *Näkymät ja tiedostot*).
- **A folder file's own tab keeps `/offer?id=…&path=…`**; only the offer has a
  stable address.
